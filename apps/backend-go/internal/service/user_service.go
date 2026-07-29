package service

import (
	"context"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) List(ctx context.Context, page, size int, keyword string) ([]*model.User, int, error) {
	return s.repo.List(ctx, page, size, keyword)
}

func (s *UserService) Get(ctx context.Context, id string) (*model.User, error) {
	return s.repo.Get(ctx, id)
}

func (s *UserService) Create(ctx context.Context, username, password, name, role string) (*model.User, error) {
	if role == "" {
		role = "user"
	}
	if password == "" {
		return nil, ErrInvalidCredentials
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	u := &model.User{
		ID:       uuid.NewString(),
		Username: username,
		Name:     name,
		Role:     role,
		Status:   "active",
		Password: string(hash),
	}
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// Update 更新用户基本信息，并可选地修改密码。
//
// 设计原因：旧实现把 password 列放进通用 Update SQL，而调用方组装 model.User
// 时通常不填 Password，导致每次 PUT 用户都把密码清空（数据损坏 Bug 2）。
// 现在 Update SQL 不再含 password 列；仅当 newPassword 非空时，单独走
// UpdatePassword 流程（先 bcrypt 再更新），与 Java UserMapper.update 行为一致。
//
// newPassword 为空字符串表示不改密（保持原密码不变）。
func (s *UserService) Update(ctx context.Context, u *model.User, newPassword string) error {
	if err := s.repo.Update(ctx, u); err != nil {
		return err
	}
	if newPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if err := s.repo.UpdatePassword(ctx, u.ID, string(hash)); err != nil {
			return err
		}
		// 回填内存对象，便于上层返回一致状态（Password 字段 json:"-" 不外泄）。
		u.Password = string(hash)
	}
	return nil
}

