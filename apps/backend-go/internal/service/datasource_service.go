package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

// DatasourceService implements datasource CRUD + connection probe, mirroring the
// Java DatasourceService. Type whitelist (static|api) and the test-connection
// behavior are identical across the two backends so the bff/engine can call either
// transparently.
type DatasourceService struct {
	repo     *repository.DatasourceRepository
	siteRepo *repository.SiteRepository
	httpc    *http.Client
}

// NewDatasourceService wires the datasource repo and a shared HTTP client for
// connection probes. The client cap matches the Java TEST_TIMEOUT_SECONDS=5s.
func NewDatasourceService(repo *repository.DatasourceRepository, siteRepo *repository.SiteRepository) *DatasourceService {
	return &DatasourceService{
		repo:     repo,
		siteRepo: siteRepo,
		httpc:    &http.Client{Timeout: 5 * time.Second},
	}
}

// AllowedTypes is exported for tests / introspection and to keep the whitelist a
// single source of truth. Both backends enforce the same set (plan §3).
var AllowedTypes = map[string]struct{}{
	"static": {},
	"api":    {},
}

// List returns every datasource owned by siteID. siteID is required; missing or
// unknown site → ErrSiteNotFound (404), so callers can't list datasources for a
// site they fabricated.
func (s *DatasourceService) List(ctx context.Context, siteID string) ([]*model.Datasource, error) {
	if siteID == "" {
		return nil, ErrInvalidArgument
	}
	if _, err := s.siteRepo.Get(ctx, siteID); err != nil {
		return nil, err
	}
	return s.repo.ListBySite(ctx, siteID)
}

// Get returns a single datasource by id, scoped to siteID when non-empty (multi-
// tenant guard). When siteID is empty, falls back to the id-only lookup (admin /
// internal path) to preserve backward compatibility with the existing contract
// tests. Missing OR wrong-tenant → ErrDatasourceNotFound (404).
func (s *DatasourceService) Get(ctx context.Context, id, siteID string) (*model.Datasource, error) {
	if siteID == "" {
		return s.repo.Get(ctx, id)
	}
	return s.repo.GetBySiteID(ctx, id, siteID)
}

// Create validates the type whitelist, checks the site exists, and inserts.
// Duplicate (site_id, name) bubbles up as ErrDatasourceNameConflict (409).
func (s *DatasourceService) Create(ctx context.Context, siteID, name, dsType string, config json.RawMessage) (*model.Datasource, error) {
	if err := validateType(dsType); err != nil {
		return nil, err
	}
	if _, err := s.siteRepo.Get(ctx, siteID); err != nil {
		return nil, err
	}
	ds := &model.Datasource{
		ID:     uuid.NewString(),
		SiteID: siteID,
		Name:   name,
		Type:   dsType,
		Config: normalizeConfig(config),
	}
	if err := s.repo.Create(ctx, ds); err != nil {
		// Audit log on failure. NEVER log config.
		log.Printf("WARN datasource create rejected siteID=%s name=%s type=%s err=%v",
			siteID, name, dsType, err)
		return nil, err
	}
	log.Printf("INFO datasource created id=%s siteID=%s name=%s type=%s", ds.ID, siteID, name, dsType)
	return ds, nil
}

// Update validates type + ownership, then overwrites the mutable fields WITHOUT
// changing site_id (the tenant never moves). It first loads the existing row via
// GetBySiteID/Get to enforce ownership AND to backfill CreatedAt so the handler
// returns a complete entity (fixes the createdAt zero-value bug, review-go-api C3).
// siteID empty → admin/internal fallback (no ownership check).
// Missing datasource → ErrDatasourceNotFound (404); name conflict → 409.
// Returns the updated entity so callers don't need a second read.
func (s *DatasourceService) Update(ctx context.Context, siteID, id, name, dsType string, config json.RawMessage) (*model.Datasource, error) {
	if err := validateType(dsType); err != nil {
		return nil, err
	}
	var existing *model.Datasource
	var err error
	if siteID == "" {
		existing, err = s.repo.Get(ctx, id)
	} else {
		existing, err = s.repo.GetBySiteID(ctx, id, siteID)
	}
	if err != nil {
		return nil, err
	}
	ds := &model.Datasource{
		ID:        id,
		SiteID:    existing.SiteID, // preserve original tenant; ignore caller-supplied siteID
		Name:      name,
		Type:      dsType,
		Config:    normalizeConfig(config),
		CreatedAt: existing.CreatedAt, // backfill so the response isn't zero-valued
	}
	if err := s.repo.Update(ctx, ds); err != nil {
		// Audit log on failure. NEVER log config (may contain secrets/headers) —
		// only id/siteID/name/type + the wrapped error.
		log.Printf("WARN datasource update failed id=%s siteID=%s name=%s type=%s err=%v",
			id, ds.SiteID, name, dsType, err)
		return nil, err
	}
	return ds, nil
}

// Delete removes a datasource, scoped to siteID when non-empty (multi-tenant guard).
// siteID empty → admin/internal fallback. Missing OR wrong-tenant →
// ErrDatasourceNotFound (404).
func (s *DatasourceService) Delete(ctx context.Context, id, siteID string) error {
	if siteID == "" {
		return s.repo.Delete(ctx, id)
	}
	return s.repo.DeleteBySiteID(ctx, id, siteID)
}

// TestConnectionResult is the response shape for POST /datasources/:id/test.
// Field names match the Java DatasourceTestResult record (ok/message/latencyMs)
// so both backends return identical JSON.
type TestConnectionResult struct {
	OK        bool   `json:"ok"`
	Message   string `json:"message"`
	LatencyMs int64  `json:"latencyMs"`
}

// TestConnection probes a datasource. For static datasources there is no remote,
// so it returns ok=true with latency 0 immediately (matches Java). For api
// datasources it issues a GET against config.url (optional config.headers) with
// the shared 5s-capped client; any non-2xx or IO error becomes
// ErrDatasourceConnectionFailed (503).
//
// SSRF note: this is a server-to-server probe against an admin-configured URL.
// User-driven arbitrary fetches go through the BFF proxy/fetch route, which owns
// the SSRF allowlist. Here we only validate that config.url parses.
func (s *DatasourceService) TestConnection(ctx context.Context, id string) (*TestConnectionResult, error) {
	ds, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if ds.Type == "static" {
		return &TestConnectionResult{OK: true, Message: "static datasource: no remote to probe", LatencyMs: 0}, nil
	}

	cfg := struct {
		URL     string            `json:"url"`
		Headers map[string]string `json:"headers"`
	}{}
	if err := json.Unmarshal(ds.Config, &cfg); err != nil {
		return nil, fmt.Errorf("%w: invalid config json", ErrDatasourceConnectionFailed)
	}
	if cfg.URL == "" {
		return nil, fmt.Errorf("%w: config.url is required for api datasource", ErrDatasourceConnectionFailed)
	}

	// Explicit per-call deadline so a hung upstream can't outlive the request even
	// if the caller's ctx has no deadline. 5s matches the Java TEST_TIMEOUT_SECONDS;
	// httpc.Timeout below acts as belt-and-suspenders backstop.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDatasourceConnectionFailed, err.Error())
	}
	for k, v := range cfg.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := s.httpc.Do(req)
	if err != nil {
		// Audit: log host + err; NEVER log headers (credentials may be present).
		log.Printf("WARN datasource probe io-failed id=%s host=%s err=%v", id, req.URL.Host, err)
		return nil, fmt.Errorf("%w: %s", ErrDatasourceConnectionFailed, err.Error())
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)
	latency := time.Since(start).Milliseconds()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		log.Printf("WARN datasource probe bad-status id=%s host=%s status=%d", id, req.URL.Host, resp.StatusCode)
		return nil, fmt.Errorf("%w: HTTP %d", ErrDatasourceConnectionFailed, resp.StatusCode)
	}
	return &TestConnectionResult{OK: true, Message: fmt.Sprintf("HTTP %d", resp.StatusCode), LatencyMs: latency}, nil
}

func validateType(t string) error {
	if _, ok := AllowedTypes[t]; !ok {
		return fmt.Errorf("%w: type must be one of static, api", ErrInvalidArgument)
	}
	return nil
}

func normalizeConfig(config json.RawMessage) json.RawMessage {
	if len(config) == 0 {
		return json.RawMessage(`{}`)
	}
	return config
}
