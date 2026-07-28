package router

import (
	"github.com/gin-gonic/gin"
	"github.com/xiaoshuai1024/luban-backend-go/dao"
	"github.com/xiaoshuai1024/luban-backend-go/internal/handler"
	"github.com/xiaoshuai1024/luban-backend-go/internal/middleware"
	"github.com/xiaoshuai1024/luban-backend-go/internal/repository"
	"github.com/xiaoshuai1024/luban-backend-go/internal/service"
)

// InitRouter 初始化路由
func InitRouter() *gin.Engine {
	if gin.Mode() == gin.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// 健康检查
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	// 初始化依赖（简单组合，后续可以抽到单独的 wire/di 包）
	siteRepo := repository.NewSiteRepository(dao.DB)
	pageRepo := repository.NewPageRepository(dao.DB)
	userRepo := repository.NewUserRepository(dao.DB)
	settingsRepo := repository.NewSettingsRepository(dao.DB)
	datasourceRepo := repository.NewDatasourceRepository(dao.DB)
	collectionRepo := repository.NewCollectionRepository(dao.DB)

	authSvc := service.NewAuthService(userRepo)
	siteSvc := service.NewSiteService(siteRepo)
	pageSvc := service.NewPageService(pageRepo)
	userSvc := service.NewUserService(userRepo)
	settingsSvc := service.NewSettingsService(settingsRepo, dao.RDB)
	publicSvc := service.NewPublicService(siteRepo, pageRepo)
	datasourceSvc := service.NewDatasourceService(datasourceRepo, siteRepo)
	collectionSvc := service.NewCollectionService(collectionRepo, siteRepo)

	authH := handler.NewAuthHandler(authSvc)
	siteH := handler.NewSiteHandler(siteSvc)
	pageH := handler.NewPageHandler(pageSvc)
	userH := handler.NewUserHandler(userSvc)
	settingsH := handler.NewSettingsHandler(settingsSvc)
	publicH := handler.NewPublicHandler(publicSvc)
	datasourceH := handler.NewDatasourceHandler(datasourceSvc)
	collectionH := handler.NewCollectionHandler(collectionSvc)

	mw := middleware.NewMiddleware()

	api := r.Group("/backend")

	// Public（无需鉴权，对齐 Java AuthFilter 放行 /backend/public/*）
	public := api.Group("/public")
	public.GET("/sites/:slug/pages", publicH.GetByPath)

	// Auth
	api.POST("/auth/login", authH.Login)
	api.GET("/auth/me", mw.RequireUser(), authH.Me)

	// Sites
	sites := api.Group("/sites", mw.RequireUser())
	sites.GET("", siteH.List)
	sites.POST("", mw.RequireAdmin(), siteH.Create)
	sites.GET("/:id", siteH.Get)
	sites.PUT("/:id", mw.RequireAdmin(), siteH.Update)
	sites.DELETE("/:id", mw.RequireAdmin(), siteH.Delete)

	// Pages（挂在 /sites/:id/pages 下，参数统一为 :id）
	pages := api.Group("/sites/:id/pages", mw.RequireUser())
	pages.GET("", pageH.List)
	pages.POST("", pageH.Create)
	pages.GET("/:pageId", pageH.Get)
	pages.PUT("/:pageId", pageH.Update)
	pages.DELETE("/:pageId", pageH.Delete)

	// Users
	users := api.Group("/users", mw.RequireUser(), mw.RequireAdmin())
	users.GET("", userH.List)
	users.POST("", userH.Create)
	users.GET("/:id", userH.Get)
	users.PUT("/:id", userH.Update)
	users.PATCH("/:id/status", userH.UpdateStatus)

	// Settings
	settings := api.Group("/settings", mw.RequireAdmin())
	settings.GET("", settingsH.Get)
	settings.PUT("", settingsH.Update)

	// Datasources (W1-T2). All routes RequireUser; write ops (POST/PUT/DELETE)
	// additionally RequireAdmin. GET and /test are read-only → RequireUser only.
	// Parity with Java AuthFilter ADMIN_DATASOURCES pattern.
	datasources := api.Group("/datasources", mw.RequireUser())
	datasources.GET("", datasourceH.List)
	datasources.POST("", mw.RequireAdmin(), datasourceH.Create)
	datasources.GET("/:id", datasourceH.Get)
	datasources.PUT("/:id", mw.RequireAdmin(), datasourceH.Update)
	datasources.DELETE("/:id", mw.RequireAdmin(), datasourceH.Delete)
	datasources.POST("/:id/test", datasourceH.Test)

	// V2-T7 Collections CMS（对齐 Java CollectionController）。
	// 读 RequireUser；写 RequireAdmin（admin-only 写，站点级隔离由 siteId query guard）。
	collections := api.Group("/collections", mw.RequireUser())
	collections.GET("", collectionH.List)
	collections.POST("", mw.RequireAdmin(), collectionH.Create)
	collections.GET("/:id", collectionH.Get)
	collections.PUT("/:id", mw.RequireAdmin(), collectionH.Update)
	collections.DELETE("/:id", mw.RequireAdmin(), collectionH.Delete)
	// CollectionItem 嵌套在 /collections/:collectionId/items 下
	collections.GET("/:collectionId/items", collectionH.ListItems)
	collections.POST("/:collectionId/items", mw.RequireAdmin(), collectionH.CreateItem)
	collections.GET("/:collectionId/items/:itemId", collectionH.GetItem)
	collections.PUT("/:collectionId/items/:itemId", mw.RequireAdmin(), collectionH.UpdateItem)
	collections.DELETE("/:collectionId/items/:itemId", mw.RequireAdmin(), collectionH.DeleteItem)

	return r
}

