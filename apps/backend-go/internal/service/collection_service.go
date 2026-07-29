package service

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

// V2-T7 CollectionService — 对齐 Java CollectionService（CRUD + siteId guard）。
type CollectionService struct {
	repo     *repository.CollectionRepository
	siteRepo *repository.SiteRepository
}

func NewCollectionService(repo *repository.CollectionRepository, siteRepo *repository.SiteRepository) *CollectionService {
	return &CollectionService{repo: repo, siteRepo: siteRepo}
}

// === Collection ===

func (s *CollectionService) List(ctx context.Context, siteID string) ([]*model.Collection, error) {
	if _, err := s.siteRepo.Get(ctx, siteID); err != nil {
		return nil, repository.ErrSiteNotFound
	}
	return s.repo.ListBySite(ctx, siteID)
}

func (s *CollectionService) Get(ctx context.Context, siteID, id string) (*model.Collection, error) {
	return s.repo.Get(ctx, siteID, id)
}

func (s *CollectionService) Create(ctx context.Context, siteID, name string, fieldSchema json.RawMessage, status string) (*model.Collection, error) {
	if _, err := s.siteRepo.Get(ctx, siteID); err != nil {
		return nil, repository.ErrSiteNotFound
	}
	if status == "" {
		status = "active"
	}
	if len(fieldSchema) == 0 {
		fieldSchema = json.RawMessage(`{}`)
	}
	c := &model.Collection{
		ID:          uuid.NewString(),
		SiteID:      siteID,
		Name:        name,
		FieldSchema: fieldSchema,
		Status:      status,
	}
	if err := s.repo.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CollectionService) Update(ctx context.Context, c *model.Collection) error {
	return s.repo.Update(ctx, c)
}

func (s *CollectionService) Delete(ctx context.Context, siteID, id string) error {
	return s.repo.Delete(ctx, siteID, id)
}

// === CollectionItem ===

func (s *CollectionService) ListItems(ctx context.Context, siteID, collectionID string) ([]*model.CollectionItem, error) {
	if _, err := s.repo.Get(ctx, siteID, collectionID); err != nil {
		return nil, err
	}
	return s.repo.ListItems(ctx, collectionID)
}

func (s *CollectionService) GetItem(ctx context.Context, siteID, collectionID, itemID string) (*model.CollectionItem, error) {
	if _, err := s.repo.Get(ctx, siteID, collectionID); err != nil {
		return nil, err
	}
	return s.repo.GetItem(ctx, collectionID, itemID)
}

func (s *CollectionService) CreateItem(ctx context.Context, siteID, collectionID string, data json.RawMessage, status string) (*model.CollectionItem, error) {
	if _, err := s.repo.Get(ctx, siteID, collectionID); err != nil {
		return nil, err
	}
	if status == "" {
		status = "active"
	}
	if len(data) == 0 {
		data = json.RawMessage(`{}`)
	}
	it := &model.CollectionItem{
		ID:           uuid.NewString(),
		CollectionID: collectionID,
		Data:         data,
		Status:       status,
	}
	if err := s.repo.CreateItem(ctx, it); err != nil {
		return nil, err
	}
	return it, nil
}

func (s *CollectionService) UpdateItem(ctx context.Context, it *model.CollectionItem) error {
	return s.repo.UpdateItem(ctx, it)
}

func (s *CollectionService) DeleteItem(ctx context.Context, siteID, collectionID, itemID string) error {
	if _, err := s.repo.Get(ctx, siteID, collectionID); err != nil {
		return err
	}
	return s.repo.DeleteItem(ctx, collectionID, itemID)
}
