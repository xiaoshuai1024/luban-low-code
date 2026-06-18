package service

import (
	"context"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

// PublicService 公开接口服务：按站点 slug + 路径返回已发布页面（无需鉴权）。
//
// 对齐 Java PublicPageService.getPublishedPageBySlugAndPath：
//  1. path 为空时归一化为 "/"；无前导 "/" 则补上。
//  2. 按 slug 查站点（无 → ErrSiteNotFound）。
//  3. 按 site_id + path 查已发布页面（无 → ErrPageNotFound）。
//  4. 直接返回 *model.Page（schema 为 json.RawMessage，序列化即为嵌套对象，
//     与 Java PageResponse.schema 行为一致）。
type PublicService struct {
	siteRepo *repository.SiteRepository
	pageRepo *repository.PageRepository
}

func NewPublicService(siteRepo *repository.SiteRepository, pageRepo *repository.PageRepository) *PublicService {
	return &PublicService{siteRepo: siteRepo, pageRepo: pageRepo}
}

// GetPublishedPageBySlugAndPath 公开接口核心逻辑。
func (s *PublicService) GetPublishedPageBySlugAndPath(ctx context.Context, slug, path string) (*model.Page, error) {
	site, err := s.siteRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	// path 归一化：对齐 Java（path != null && !path.isEmpty() ? path : "/"）
	pathNorm := path
	if pathNorm == "" {
		pathNorm = "/"
	}
	if len(pathNorm) == 0 || pathNorm[0] != '/' {
		pathNorm = "/" + pathNorm
	}
	page, err := s.pageRepo.GetPublishedBySiteAndPath(ctx, site.ID, pathNorm)
	if err != nil {
		return nil, err
	}
	return page, nil
}
