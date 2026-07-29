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

// Me 按 userId 返回当前登录用户的完整信息（用于 /auth/me）。
//
// 对齐 Java AuthService.me：从 DB 按 id 取最新 user 并返回。User.Password 字段
// 标了 json:"-"，序列化时自动脱敏，不会把密码哈希暴露给前端。
// 用户不存在返回 ErrUserNotFound（对齐 Java BusinessException.userNotFound()）。
func (s *AuthService) Me(ctx context.Context, userID string) (*model.User, error) {
	return s.userRepo.Get(ctx, userID)
}

