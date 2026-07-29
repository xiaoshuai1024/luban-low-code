package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

type SiteService struct {
	repo *repository.SiteRepository
}

func NewSiteService(repo *repository.SiteRepository) *SiteService {
	return &SiteService{repo: repo}
}

func (s *SiteService) List(ctx context.Context) ([]*model.Site, error) {
	return s.repo.List(ctx)
}

func (s *SiteService) Get(ctx context.Context, id string) (*model.Site, error) {
	return s.repo.Get(ctx, id)
}

func (s *SiteService) Create(ctx context.Context, name, slug, baseURL, status string) (*model.Site, error) {
	if status == "" {
		status = "active"
	}
	site := &model.Site{
		ID:      uuid.NewString(),
		Name:    name,
		Slug:    slug,
		BaseURL: baseURL,
		Status:  status,
	}
	if err := s.repo.Create(ctx, site); err != nil {
		return nil, err
	}
	return site, nil
}

func (s *SiteService) Update(ctx context.Context, site *model.Site) error {
	return s.repo.Update(ctx, site)
}

func (s *SiteService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

