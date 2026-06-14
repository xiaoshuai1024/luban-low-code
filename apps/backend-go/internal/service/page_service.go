package service

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

type PageService struct {
	repo *repository.PageRepository
}

func NewPageService(repo *repository.PageRepository) *PageService {
	return &PageService{repo: repo}
}

func (s *PageService) List(ctx context.Context, siteID string) ([]*model.Page, error) {
	return s.repo.ListBySite(ctx, siteID)
}

func (s *PageService) Get(ctx context.Context, siteID, pageID string) (*model.Page, error) {
	return s.repo.Get(ctx, siteID, pageID)
}

func (s *PageService) Create(ctx context.Context, siteID, name, path, status string, schema json.RawMessage) (*model.Page, error) {
	if status == "" {
		status = "draft"
	}
	page := &model.Page{
		ID:     uuid.NewString(),
		SiteID: siteID,
		Name:   name,
		Path:   path,
		Status: status,
		Schema: schema,
	}
	if err := s.repo.Create(ctx, page); err != nil {
		return nil, err
	}
	return page, nil
}

func (s *PageService) Update(ctx context.Context, p *model.Page) error {
	return s.repo.Update(ctx, p)
}

func (s *PageService) Delete(ctx context.Context, siteID, pageID string) error {
	return s.repo.Delete(ctx, siteID, pageID)
}

