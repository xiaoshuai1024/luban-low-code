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

func (s *UserService) Update(ctx context.Context, u *model.User) error {
	return s.repo.Update(ctx, u)
}

