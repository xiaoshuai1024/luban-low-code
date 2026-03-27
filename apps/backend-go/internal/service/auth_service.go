package service

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("INVALID_CREDENTIALS")
	ErrUserDisabled       = errors.New("USER_DISABLED")
)

type AuthService struct {
	userRepo *repository.UserRepository
}

func NewAuthService(userRepo *repository.UserRepository) *AuthService {
	return &AuthService{userRepo: userRepo}
}

type LoginResult struct {
	User   *model.User       `json:"user"`
	Claims map[string]string `json:"claims"`
}

func (s *AuthService) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	u, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if u.Status != "active" {
		return nil, ErrUserDisabled
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)) != nil {
		return nil, ErrInvalidCredentials
	}
	return &LoginResult{
		User: u,
		Claims: map[string]string{
			"userId": u.ID,
			"role":   u.Role,
		},
	}, nil
}

