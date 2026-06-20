package repository

import "errors"

var (
	ErrSiteNotFound          = errors.New("SITE_NOT_FOUND")
	ErrPageNotFound          = errors.New("PAGE_NOT_FOUND")
	ErrUserNotFound          = errors.New("USER_NOT_FOUND")
	ErrSettingsNotFound      = errors.New("SETTINGS_NOT_FOUND")
	ErrSlugConflict          = errors.New("SLUG_CONFLICT")
	ErrPagePathConflict      = errors.New("PAGE_PATH_CONFLICT")
	ErrUsernameConflict      = errors.New("USERNAME_CONFLICT")
	ErrDatasourceNotFound    = errors.New("DATASOURCE_NOT_FOUND")
	ErrDatasourceNameConflict = errors.New("DATASOURCE_NAME_CONFLICT")
)

