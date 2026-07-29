package service

import "errors"

// Service-level errors. These are distinct from repository errors: they encode
// business-rule failures (e.g. type whitelist, connection probe outcome) that the
// repository layer has no business knowing about. The handler maps each one to an
// HTTP status + code (see internal/handler/error.go).
var (
	// ErrInvalidArgument is returned when a request fails business validation
	// (e.g. datasource type not in {static, api}, missing siteId on list).
	// Mapped to 400 INVALID_ARGUMENT, matching Java BusinessException.invalidArgument.
	ErrInvalidArgument = errors.New("INVALID_ARGUMENT")

	// ErrDatasourceConnectionFailed is returned by TestConnection when a probe of an
	// api datasource fails (missing url, invalid url, non-2xx response, or IO error).
	// Mapped to 503 DATASOURCE_CONNECTION_FAILED, matching Java
	// BusinessException.datasourceConnectionFailed.
	ErrDatasourceConnectionFailed = errors.New("DATASOURCE_CONNECTION_FAILED")
)
