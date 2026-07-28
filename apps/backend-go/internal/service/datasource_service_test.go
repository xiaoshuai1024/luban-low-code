package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

// now is a sentinel timestamp used to populate created_at/updated_at columns in
// sqlmock rows. Passing real time.Time values (not nil) avoids "unsupported Scan,
// storing driver.Value type <nil> into type *time.Time" failures when sqlx scans
// the result back into model.Site / model.Datasource.
var testNow = time.Date(2026, 6, 19, 0, 0, 0, 0, time.UTC)

func siteColumns() []string {
	return []string{"id", "name", "slug", "base_url", "status", "created_at", "updated_at"}
}

func datasourceColumns() []string {
	return []string{"id", "site_id", "name", "type", "config_json", "created_at", "updated_at"}
}

func newDatasourceSvcMock(t *testing.T) (*DatasourceService, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	dsRepo := repository.NewDatasourceRepository(sqlx.NewDb(db, "mysql"))
	siteRepo := repository.NewSiteRepository(sqlx.NewDb(db, "mysql"))
	return NewDatasourceService(dsRepo, siteRepo), mock
}

// TestCreate_RejectsInvalidType enforces the static|api whitelist — parity with
// Java DatasourceService.validateType → INVALID_ARGUMENT (400). The repo is never
// reached for an invalid type, so no SQL expectations are set.
func TestCreate_RejectsInvalidType(t *testing.T) {
	svc, _ := newDatasourceSvcMock(t)
	_, err := svc.Create(context.Background(), "s-1", "cfg", "mysql", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInvalidArgument)
}

// TestCreate_PropagatesSiteNotFound verifies that a missing site surfaces as
// ErrSiteNotFound (the repo's sql.ErrNoRows → ErrSiteNotFound mapping), so the
// handler returns 404 SITE_NOT_FOUND — matching Java.
func TestCreate_PropagatesSiteNotFound(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM sites").
		WithArgs("nope").
		WillReturnError(repository.ErrSiteNotFound)

	_, err := svc.Create(context.Background(), "nope", "cfg", "static", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, repository.ErrSiteNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestCreate_PropagatesNameConflict verifies duplicate (site_id, name) → 409.
func TestCreate_PropagatesNameConflict(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM sites").WithArgs("s-1").
		WillReturnRows(sqlmock.NewRows(siteColumns()).
			AddRow("s-1", "S1", "s1", "", "active", testNow, testNow))
	mock.ExpectExec("INSERT INTO datasources").
		WillReturnError(errors.New("Error 1062: Duplicate entry 's-1-cfg' for key 'uk_datasources_site_name'"))

	_, err := svc.Create(context.Background(), "s-1", "cfg", "static", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, repository.ErrDatasourceNameConflict)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestList_RequiresSiteID verifies missing siteId → ErrInvalidArgument (400).
func TestList_RequiresSiteID(t *testing.T) {
	svc, _ := newDatasourceSvcMock(t)
	_, err := svc.List(context.Background(), "")
	assert.ErrorIs(t, err, ErrInvalidArgument)
}

// TestTestConnection_StaticReturnsOk verifies static datasources short-circuit
// to ok=true, latency 0 — no HTTP, matches Java.
func TestTestConnection_StaticReturnsOk(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-1", "s-1", "cfg", "static", []byte(`{}`), testNow, testNow))

	res, err := svc.TestConnection(context.Background(), "ds-1")
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.True(t, res.OK)
	assert.Equal(t, int64(0), res.LatencyMs)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestTestConnection_ApiMissingURLFails verifies api datasource without config.url
// → ErrDatasourceConnectionFailed (503), matching Java.
func TestTestConnection_ApiMissingURLFails(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-1", "s-1", "cfg", "api", []byte(`{"headers":{}}`), testNow, testNow))

	_, err := svc.TestConnection(context.Background(), "ds-1")
	assert.ErrorIs(t, err, ErrDatasourceConnectionFailed)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestTestConnection_ApiHit2xxReturnsOk stands up a real httptest server returning
// 200, then probes it. Asserts ok=true and latency > 0 (proves we actually did the
// HTTP round-trip rather than short-circuiting).
func TestTestConnection_ApiHit2xxReturnsOk(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-1", "s-1", "cfg", "api", []byte(`{"url":"`+srv.URL+`"}`), testNow, testNow))

	res, err := svc.TestConnection(context.Background(), "ds-1")
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.True(t, res.OK)
	// Message carries the real upstream status, proving we actually made the HTTP
	// round-trip (rather than short-circuiting like the static branch). We don't
	// assert latency > 0: a localhost httptest round-trip can complete in <1ms,
	// which truncates to 0ms and would make the test flaky.
	assert.Equal(t, "HTTP 200", res.Message)
	assert.GreaterOrEqual(t, res.LatencyMs, int64(0))
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestTestConnection_ApiHit5xxFails verifies a real upstream 500 → 503
// DATASOURCE_CONNECTION_FAILED (we don't leak the upstream status as our own).
func TestTestConnection_ApiHit5xxFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-1", "s-1", "cfg", "api", []byte(`{"url":"`+srv.URL+`"}`), testNow, testNow))

	_, err := svc.TestConnection(context.Background(), "ds-1")
	assert.ErrorIs(t, err, ErrDatasourceConnectionFailed)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestUpdate_RejectsInvalidType guards the whitelist on the update path too.
func TestUpdate_RejectsInvalidType(t *testing.T) {
	svc, _ := newDatasourceSvcMock(t)
	_, err := svc.Update(context.Background(), "s-1", "ds-1", "x", "postgres", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInvalidArgument)
}

// TestUpdate_NotFoundPropagates verifies the ownership check: when the existing row
// can't be loaded (wrong id OR wrong site_id), Update returns ErrDatasourceNotFound
// without attempting the SQL write. This is the multi-tenant guard at the service
// layer (plan §7 #4: site B cannot update site A's datasource by id).
func TestUpdate_NotFoundPropagates(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1", "s-1").
		WillReturnError(repository.ErrDatasourceNotFound)

	_, err := svc.Update(context.Background(), "s-1", "ds-1", "x", "static", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, repository.ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestUpdate_PreservesOriginalSiteIDAndBackfillsCreatedAt verifies two behaviors:
// (1) the caller cannot move a datasource to another tenant via Update (site_id is
// preserved from the existing row), and (2) CreatedAt is backfilled from the
// existing row so the handler returns a complete entity (fixes the createdAt
// zero-value bug, review-go-api C3).
func TestUpdate_PreservesOriginalSiteIDAndBackfillsCreatedAt(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	created := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	// existing row belongs to s-orig (NOT the s-other the caller tries to inject)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1", "s-orig").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-1", "s-orig", "old", "static", []byte(`{}`), created, created))
	// Match by prefix — sqlmock treats the pattern as a regexp, and the literal `?`
	// placeholders in the UPDATE SQL are regexp metacharacters. A prefix match avoids
	// having to escape every placeholder while still pinning the statement.
	mock.ExpectExec("UPDATE datasources SET name").WithArgs("new", "api", []byte(`{}`), sqlmock.AnyArg(), "ds-1", "s-orig").
		WillReturnResult(sqlmock.NewResult(0, 1))

	ds, err := svc.Update(context.Background(), "s-orig", "ds-1", "new", "api", json.RawMessage(`{}`))
	require.NoError(t, err)
	require.NotNil(t, ds)
	assert.Equal(t, "s-orig", ds.SiteID, "site_id must be preserved from existing row, not overwritten")
	assert.Equal(t, created, ds.CreatedAt, "CreatedAt must be backfilled from existing row")
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestList_MultiTenantIsolation (plan §7 #4): site A's datasources must never
// include site B's ids. Enforces the multi-tenant read guard at the service layer.
func TestList_MultiTenantIsolation(t *testing.T) {
	svc, mock := newDatasourceSvcMock(t)
	// site A exists + returns only ds-A
	mock.ExpectQuery("SELECT .* FROM sites").WithArgs("site-A").
		WillReturnRows(sqlmock.NewRows(siteColumns()).AddRow("site-A", "A", "a", "", "active", testNow, testNow))
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("site-A").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-A", "site-A", "cfg", "static", []byte(`{}`), testNow, testNow))
	// site B exists + returns only ds-B
	mock.ExpectQuery("SELECT .* FROM sites").WithArgs("site-B").
		WillReturnRows(sqlmock.NewRows(siteColumns()).AddRow("site-B", "B", "b", "", "active", testNow, testNow))
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("site-B").
		WillReturnRows(sqlmock.NewRows(datasourceColumns()).
			AddRow("ds-B", "site-B", "cfg", "static", []byte(`{}`), testNow, testNow))

	a, err := svc.List(context.Background(), "site-A")
	require.NoError(t, err)
	b, err := svc.List(context.Background(), "site-B")
	require.NoError(t, err)
	require.Len(t, a, 1)
	require.Len(t, b, 1)
	assert.Equal(t, "ds-A", a[0].ID)
	assert.Equal(t, "ds-B", b[0].ID)
	// site A must NOT contain site B's datasource id (no cross-tenant leak)
	for _, d := range a {
		assert.NotEqual(t, "ds-B", d.ID, "site A leaked site B's datasource")
	}
	require.NoError(t, mock.ExpectationsWereMet())
}
