package repository

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

// capturingMatcher 是一个自定义 sqlmock QueryMatcher：除了按原正则匹配外，
// 会把每次执行的实际 SQL 文本拷贝到 *captured，供测试做文本断言。
// 这样我们既能用 ExpectExec 驱动测试流程，又能拿到真实 SQL 做回归守护。
type capturingMatcher struct {
	regexp   string
	captured *string
}

func (m capturingMatcher) Match(expectedSQL, actualSQL string) error {
	*m.captured = actualSQL
	return sqlmock.QueryMatcherRegexp.Match(expectedSQL, actualSQL)
}

// newCapturingMock 创建一个能捕获实际 SQL 的 sqlmock。
// 返回 mock 与指向 captured 的指针（每次 Exec 后读取即可）。
func newCapturingMock(t *testing.T) (sqlmock.Sqlmock, *string) {
	t.Helper()
	captured := new(string)
	db, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(capturingMatcher{captured: captured}),
	)
	require.NoError(t, err)
	// 用 sqlx 包一下，但 UserRepository.db 类型是 *sqlx.DB。
	_ = sqlx.NewDb(db, "mysql")
	return mock, captured
}

func newRepoFromMockDB(t *testing.T) (*UserRepository, sqlmock.Sqlmock, *string) {
	t.Helper()
	captured := new(string)
	db, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(capturingMatcher{captured: captured}),
	)
	require.NoError(t, err)
	return &UserRepository{db: sqlx.NewDb(db, "mysql")}, mock, captured
}

// newUserFixture 构造一个仅含基本字段的 model.User 用于测试（不含 Password），
// 模拟 handler/service 组装时的真实情况——正是 Bug 2 触发场景。
func newUserFixture(id string) *model.User {
	return &model.User{
		ID:        id,
		Username:  "tester",
		Name:      "Tester",
		Role:      "user",
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// TestUpdate_SQLExcludesPassword 是 Bug 2 的回归守护。
//
// 背景：旧版 Update SQL 包含 password 列，调用方组装 model.User 时通常不填
// Password（零值空串），导致每次 PUT 用户都把密码清空。修复后 Update SQL
// 不再含 password 列，改密走专用 UpdatePassword。
//
// 本测试断言：
//  1. Update 发出的 SQL 文本不含 "password" 关键字（大小写不敏感）。
//  2. Update SQL 含 username/role/status（确认是真正的 Update，而非退化）。
// 失败即代表 Bug 2 回归。
func TestUpdate_SQLExcludesPassword(t *testing.T) {
	repo, mock, captured := newRepoFromMockDB(t)

	mock.ExpectExec("UPDATE users").WillReturnResult(sqlmock.NewResult(0, 1))

	u := newUserFixture("u-1")
	err := repo.Update(context.Background(), u)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())

	sqlLower := strings.ToLower(*captured)
	assert.False(t,
		strings.Contains(sqlLower, "password"),
		"Update SQL must NOT contain password column (Bug 2 regression). SQL: %s", *captured,
	)
	assert.Contains(t, sqlLower, "username")
	assert.Contains(t, sqlLower, "role")
	assert.Contains(t, sqlLower, "status")
}

// TestUpdatePassword_SQLUpdatesPasswordOnly 验证改密走专用 SQL，且只动 password + updated_at。
func TestUpdatePassword_SQLUpdatesPasswordOnly(t *testing.T) {
	repo, mock, captured := newRepoFromMockDB(t)

	mock.ExpectExec("UPDATE users").WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdatePassword(context.Background(), "u-1", "$2a$10$hashedvalue")
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())

	sqlLower := strings.ToLower(*captured)
	assert.True(t,
		strings.Contains(sqlLower, "password"),
		"UpdatePassword SQL must contain password column. SQL: %s", *captured,
	)
	assert.False(t,
		strings.Contains(sqlLower, "username"),
		"UpdatePassword SQL should only touch password, got username in: %s", *captured,
	)
	assert.False(t,
		strings.Contains(sqlLower, "role"),
		"UpdatePassword SQL should only touch password, got role in: %s", *captured,
	)
}

// TestUpdate_NoRowsAffectedReturnsUserNotFound 验证 0 行影响时返回 ErrUserNotFound。
func TestUpdate_NoRowsAffectedReturnsUserNotFound(t *testing.T) {
	repo, mock, _ := newRepoFromMockDB(t)
	mock.ExpectExec("UPDATE users").WillReturnResult(sqlmock.NewResult(0, 0))
	err := repo.Update(context.Background(), newUserFixture("missing"))
	assert.ErrorIs(t, err, ErrUserNotFound)
}

// TestUpdatePassword_NoRowsAffectedReturnsUserNotFound
func TestUpdatePassword_NoRowsAffectedReturnsUserNotFound(t *testing.T) {
	repo, mock, _ := newRepoFromMockDB(t)
	mock.ExpectExec("UPDATE users").WillReturnResult(sqlmock.NewResult(0, 0))
	err := repo.UpdatePassword(context.Background(), "missing", "hash")
	assert.ErrorIs(t, err, ErrUserNotFound)
}
