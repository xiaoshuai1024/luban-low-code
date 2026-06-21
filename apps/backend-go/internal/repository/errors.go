package repository

import "errors"

var (
	ErrSiteNotFound           = errors.New("SITE_NOT_FOUND")
	ErrPageNotFound           = errors.New("PAGE_NOT_FOUND")
	ErrUserNotFound           = errors.New("USER_NOT_FOUND")
	ErrSettingsNotFound       = errors.New("SETTINGS_NOT_FOUND")
	ErrSlugConflict           = errors.New("SLUG_CONFLICT")
	ErrPagePathConflict       = errors.New("PAGE_PATH_CONFLICT")
	ErrUsernameConflict       = errors.New("USERNAME_CONFLICT")
	ErrDatasourceNotFound     = errors.New("DATASOURCE_NOT_FOUND")
	ErrDatasourceNameConflict = errors.New("DATASOURCE_NAME_CONFLICT")
	// V2-T7 Collection CMS
	ErrCollectionNotFound     = errors.New("COLLECTION_NOT_FOUND")
	ErrCollectionNameConflict = errors.New("COLLECTION_NAME_CONFLICT")
	ErrCollectionItemNotFound = errors.New("COLLECTION_ITEM_NOT_FOUND")
)

