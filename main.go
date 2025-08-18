// main.go

package main

import (
	"fastalmaty/config"
	"fastalmaty/db"
	"fastalmaty/handlers"
	"fastalmaty/middleware"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func loadConfig() config.Config {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Файл .env не найден, используем значения по умолчанию")
	}

	secret := os.Getenv("SECRET_KEY")
	if secret == "" {
		secret = "3b46329cb9c422a0fe6a8d39dbb0abbef85e974eb4198a5cd4ba8189e0c3f828"
		log.Println("⚠️  SECRET_KEY не задан — используем небезопасный ключ!")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "6066"
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./fastalmaty.db"
	}

	return config.Config{
		SecretKey: secret,
		Port:      port,
		DbPath:    dbPath,
	}
}

func main() {
	cfg := loadConfig()

	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "debug"
	}
	gin.SetMode(ginMode)

	db.Init(cfg.DbPath)
	defer db.Close()

	router := gin.Default()

	// ✅ Исправлено: один раз 127.0.0.1
	err := router.SetTrustedProxies([]string{"127.0.0.1"})
	if err != nil {
		log.Fatal("❌ Ошибка настройки доверенных прокси:", err)
	}

	// Сессии
	store := cookie.NewStore([]byte(cfg.SecretKey))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: true,
		Secure:   false,
	})
	router.Use(sessions.Sessions("fastalmaty_session", store))

	// Статика и шаблоны
	router.LoadHTMLGlob("templates/*.html")
	router.Use(static.Serve("/static", static.LocalFile("./static", false)))

	// Роутинг для динамических шаблонов
	router.GET("/templates/:page", func(c *gin.Context) {
		page := c.Param("page")
		filePath := filepath.Join("templates", page)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Page not found"})
			return
		}
		c.File(filePath)
	})

	// API маршруты
	api := router.Group("/api")
	{
		api.POST("/login", handlers.LoginHandler)
		api.GET("/logout", middleware.AuthRequired(), handlers.LogoutHandler)
		api.GET("/stats", middleware.AuthRequired(), handlers.StatsHandler)
		api.GET("/orders", middleware.AuthRequired(), handlers.GetOrdersHandler)
		api.POST("/orders", middleware.AuthRequired(), handlers.CreateOrderHandler)
		api.GET("/courier/orders", middleware.AuthRequired(), handlers.CourierOrdersHandler)
		api.POST("/order/:id/confirm", middleware.AuthRequired(), handlers.ConfirmOrderHandler)
		api.GET("/clients/search", middleware.AuthRequired(), handlers.SearchClientHandler)
		api.POST("/clients/save", middleware.AuthRequired(), handlers.SaveClientHandler)
		api.GET("/settings", middleware.AuthRequired(), handlers.GetSettingsHandler)
		api.POST("/settings", middleware.AuthRequired(), handlers.SaveSettingsHandler)
		api.GET("/waybill/:id", middleware.AuthRequired(), handlers.WaybillHandler)
		api.POST("/orders/bulk", middleware.AuthRequired(), handlers.BulkUploadHandler)

		// ✅ Админ
		api.GET("/admin/users", middleware.AuthRequired(), handlers.GetUsersHandler)
		api.POST("/admin/users", middleware.AuthRequired(), handlers.CreateUserHandler)
		api.DELETE("/admin/users/:id", middleware.AuthRequired(), handlers.DeleteUserHandler)

		api.GET("/admin/api-keys", middleware.AuthRequired(), handlers.GetApiKeysHandler)
		api.POST("/admin/generate-api-key", middleware.AuthRequired(), handlers.GenerateApiKeyHandler)
		api.DELETE("/admin/revoke-api-key", middleware.AuthRequired(), handlers.RevokeApiKeyHandler)
	}

	// HTML страницы
	router.GET("/", middleware.AuthRequired(), handlers.IndexHandler)
	router.GET("/login", handlers.LoginPageHandler)

	printStartupBanner(cfg)

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("❌ Ошибка запуска сервера: %v", err)
	}
}

func printStartupBanner(cfg config.Config) {
	fmt.Println("")
	fmt.Println("🚀 FastAlmaty — Логистическая платформа запущена!")
	fmt.Println("──────────────────────────────────────────────")
	fmt.Printf("🏠 Режим:        %s\n", gin.Mode())
	fmt.Printf("🔗 Адрес:        http://localhost:%s\n", cfg.Port)
	fmt.Printf("🗄️  База данных:  %s\n", cfg.DbPath)
	fmt.Printf("🔑 Секрет (hash): %x\n", []byte(cfg.SecretKey)[:16])
	fmt.Printf("👥 Пользователи: admin / admin123\n")
	fmt.Printf("   (и другие: manager, courier1)\n")
	fmt.Println("──────────────────────────────────────────────")
	fmt.Println("👉 Откройте в браузере: http://localhost:" + cfg.Port + "/login")
	fmt.Println("")
}
