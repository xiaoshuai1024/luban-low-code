package service

import (
	"context"

	"github.com/go-redis/redis/v8"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

const settingsCacheKey = "settings:global"

type SettingsService struct {
	repo *repository.SettingsRepository
	rdb  *redis.Client
}

func NewSettingsService(repo *repository.SettingsRepository, rdb *redis.Client) *SettingsService {
	return &SettingsService{repo: repo, rdb: rdb}
}

func (s *SettingsService) Get(ctx context.Context) ([]byte, error) {
	if s.rdb != nil {
		if v, err := s.rdb.Get(ctx, settingsCacheKey).Bytes(); err == nil && len(v) > 0 {
			return v, nil
		}
	}
	row, err := s.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	if s.rdb != nil {
		_ = s.rdb.Set(ctx, settingsCacheKey, row.DataJSON, 0).Err()
	}
	return row.DataJSON, nil
}

func (s *SettingsService) Update(ctx context.Context, dataJSON []byte) ([]byte, error) {
	row, err := s.repo.Upsert(ctx, dataJSON)
	if err != nil {
		return nil, err
	}
	if s.rdb != nil {
		_ = s.rdb.Set(ctx, settingsCacheKey, row.DataJSON, 0).Err()
	}
	return row.DataJSON, nil
}

