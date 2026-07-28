package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE username = ?`, username)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) Get(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = ?`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) List(ctx context.Context, page, size int, keyword string) ([]*model.User, int, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	}
	offset := (page - 1) * size

	var users []*model.User
	args := []interface{}{}
	where := ""
	if keyword != "" {
		where = "WHERE username LIKE ? OR name LIKE ?"
		like := "%" + keyword + "%"
		args = append(args, like, like)
	}

	query := `SELECT * FROM users ` + where + ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	argsWithPage := append(args, size, offset)
	if err := r.db.SelectContext(ctx, &users, query, argsWithPage...); err != nil {
		return nil, 0, err
	}

	var total int
	if err := r.db.GetContext(ctx, &total, `SELECT COUNT(1) FROM users `+where, args...); err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	now := time.Now()
	u.CreatedAt = now
	u.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO users (id, username, name, role, status, password, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Username, u.Name, u.Role, u.Status, u.Password, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrUsernameConflict
		}
		return err
	}
	return nil
}

func (r *UserRepository) Update(ctx context.Context, u *model.User) error {
	u.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE users SET username=?, name=?, role=?, status=?, updated_at=? WHERE id=?`,
		u.Username, u.Name, u.Role, u.Status, u.UpdatedAt, u.ID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrUsernameConflict
		}
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

// UpdatePassword 单独更新密码哈希列。
//
// 设计原因：Update SQL 不再包含 password 列（对齐 Java UserMapper.update），
// 避免调用方因未填充 model.User.Password 而意外清空密码。改密走专用 SQL，
// 调用方需自行 bcrypt 后传入 hash。
func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	res, err := r.db.ExecContext(ctx, `
UPDATE users SET password=?, updated_at=? WHERE id=?`,
		passwordHash, time.Now(), id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

