package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

func newDatasourceRepoMock(t *testing.T) (*DatasourceRepository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	repo := NewDatasourceRepository(sqlx.NewDb(db, "mysql"))
	return repo, mock
}

// TestCreate_DuplicateNameReturnsConflict mirrors the page_repo pattern: a MySQL
// Duplicate-entry error must surface as ErrDatasourceNameConflict so the handler
// maps it to 409, matching the Java backend's DataIntegrityViolationException →
// datasourceNameConflict() handling.
func TestCreate_DuplicateNameReturnsConflict(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectExec("INSERT INTO datasources").
		WillReturnError(errors.New("Error 1062: Duplicate entry 'site-1-cfg' for key 'uk_datasources_site_name'"))

	err := repo.Create(context.Background(), &model.Datasource{
		ID: "ds-1", SiteID: "site-1", Name: "cfg", Type: "static", Config: []byte(`{}`),
	})
	assert.ErrorIs(t, err, ErrDatasourceNameConflict)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestGet_NotFoundPropagates verifies sql.ErrNoRows → ErrDatasourceNotFound.
func TestGet_NotFoundPropagates(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").
		WithArgs("nope").
		WillReturnError(sql.ErrNoRows)

	_, err := repo.Get(context.Background(), "nope")
	assert.ErrorIs(t, err, ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestUpdate_ZeroRowsAffectedReturnsNotFound verifies the 0-rows-affected path
// surfaces ErrDatasourceNotFound (so PUT /datasources/:id 404s).
func TestUpdate_ZeroRowsAffectedReturnsNotFound(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectExec("UPDATE datasources").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.Update(context.Background(), &model.Datasource{
		ID: "ds-x", SiteID: "s-1", Name: "x", Type: "static", Config: []byte(`{}`), UpdatedAt: time.Now(),
	})
	assert.ErrorIs(t, err, ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestUpdate_DuplicateNameReturnsConflict verifies rename to an in-use name → 409.
func TestUpdate_DuplicateNameReturnsConflict(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectExec("UPDATE datasources").
		WillReturnError(errors.New("Error 1062: Duplicate entry 'site-1-taken' for key 'uk_datasources_site_name'"))

	err := repo.Update(context.Background(), &model.Datasource{
		ID: "ds-x", SiteID: "s-1", Name: "taken", Type: "static", Config: []byte(`{}`),
	})
	assert.ErrorIs(t, err, ErrDatasourceNameConflict)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestDelete_ZeroRowsAffectedReturnsNotFound verifies DELETE on missing id → 404.
func TestDelete_ZeroRowsAffectedReturnsNotFound(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectExec("DELETE FROM datasources").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.Delete(context.Background(), "nope")
	assert.ErrorIs(t, err, ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestGetBySiteID_NotFoundPropagates verifies the tenant-scoped lookup returns
// ErrDatasourceNotFound when the row is missing OR belongs to a different site
// (plan §7 #4 multi-tenant guard).
func TestGetBySiteID_NotFoundPropagates(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectQuery("SELECT .* FROM datasources").WithArgs("ds-1", "s-other").
		WillReturnError(sql.ErrNoRows)

	_, err := repo.GetBySiteID(context.Background(), "ds-1", "s-other")
	assert.ErrorIs(t, err, ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}

// TestDeleteBySiteID_ZeroRowsAffectedReturnsNotFound verifies the tenant-scoped
// delete surfaces NOT_FOUND when the id is missing OR belongs to another site.
func TestDeleteBySiteID_ZeroRowsAffectedReturnsNotFound(t *testing.T) {
	repo, mock := newDatasourceRepoMock(t)
	mock.ExpectExec("DELETE FROM datasources").WithArgs("ds-1", "s-other").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.DeleteBySiteID(context.Background(), "ds-1", "s-other")
	assert.ErrorIs(t, err, ErrDatasourceNotFound)
	require.NoError(t, mock.ExpectationsWereMet())
}
