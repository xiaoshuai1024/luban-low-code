package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

func newPageSvcMock(t *testing.T) (*PageService, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	repo := repository.NewPageRepository(sqlx.NewDb(db, "mysql"))
	return NewPageService(repo), mock
}

// TestCreate_DefaultStatusDraft 验证 status 为空时默认 "draft"。
//
// 对齐 Java PageService.create：if (status == null || status.isBlank()) status = "draft"。
// 注意：Java 端没有 status 白名单（不校验 draft/published 等枚举值），
// 因此 Go 端也不引入白名单，保持双后端行为一致。
func TestCreate_DefaultStatusDraft(t *testing.T) {
	svc, mock := newPageSvcMock(t)
	mock.ExpectExec("INSERT INTO pages").
		WithArgs(sqlmock.AnyArg(), "s-1", "home", "/", "draft", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	page, err := svc.Create(context.Background(), "s-1", "home", "/", "", json.RawMessage(`{}`), nil)
	require.NoError(t, err)
	require.NotNil(t, page)
	assert.Equal(t, "draft", page.Status, "empty status should default to draft")
	assert.Equal(t, "s-1", page.SiteID)
	assert.Equal(t, "/", page.Path)
	assert.NotEmpty(t, page.ID, "page should get a generated UUID")
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestCreate_ExplicitStatusPreserved 验证显式 status 被保留（不强制覆盖为 draft）。
// 这是双后端一致性的关键：Java create 也会保留调用方传入的合法 status。
func TestCreate_ExplicitStatusPreserved(t *testing.T) {
	svc, mock := newPageSvcMock(t)
	mock.ExpectExec("INSERT INTO pages").
		WithArgs(sqlmock.AnyArg(), "s-1", "home", "/", "published", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	page, err := svc.Create(context.Background(), "s-1", "home", "/", "published", json.RawMessage(`{}`), nil)
	require.NoError(t, err)
	assert.Equal(t, "published", page.Status, "explicit status should be preserved")
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestCreate_PagePathConflictPropagated 验证 path 冲突错误向上传播。
func TestCreate_PagePathConflictPropagated(t *testing.T) {
	svc, mock := newPageSvcMock(t)
	mock.ExpectExec("INSERT INTO pages").
		WillReturnError(errors.New("Error 1062: Duplicate entry '/' for key 'idx_site_path'"))

	_, err := svc.Create(context.Background(), "s-1", "home", "/", "draft", json.RawMessage(`{}`), nil)
	assert.ErrorIs(t, err, repository.ErrPagePathConflict)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestUpdate_PropagatesPageNotFound 验证 Update 0 行影响 → ErrPageNotFound。
func TestUpdate_PropagatesPageNotFound(t *testing.T) {
	svc, mock := newPageSvcMock(t)
	mock.ExpectExec("UPDATE pages").WillReturnResult(sqlmock.NewResult(0, 0))

	p := &model.Page{ID: "p-1", SiteID: "s-1", Path: "/", Name: "home", Status: "draft"}
	err := svc.Update(context.Background(), p)
	assert.ErrorIs(t, err, repository.ErrPageNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestGet_PropagatesPageNotFound 验证 Get 未命中 → ErrPageNotFound。
func TestGet_PropagatesPageNotFound(t *testing.T) {
	svc, mock := newPageSvcMock(t)
	mock.ExpectQuery("SELECT id, site_id").
		WithArgs("p-1", "s-1").
		WillReturnError(sql.ErrNoRows)

	_, err := svc.Get(context.Background(), "s-1", "p-1")
	assert.ErrorIs(t, err, repository.ErrPageNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}
