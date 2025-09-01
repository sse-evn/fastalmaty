package middleware

import (
	"database/sql"
	"fastalmaty/db"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ApiKeyAuth — проверяет Bearer-токен в заголовке
func ApiKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Требуется Authorization заголовок"})
			c.Abort()
			return
		}

		if !strings.HasPrefix(auth, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Ожидается Bearer токен"})
			c.Abort()
			return
		}

		key := strings.TrimPrefix(auth, "Bearer ")

		var apiKeyID int
		var createdBy int
		err := db.DB.QueryRow("SELECT id, created_by FROM api_keys WHERE key = ?", key).Scan(&apiKeyID, &createdBy)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный или отозванный API-ключ"})
			c.Abort()
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки ключа"})
			c.Abort()
			return
		}

		// ✅ Успешная аутентификация
		c.Set("user_id", createdBy)
		c.Set("user_role", "api") // можно "admin", но лучше ограничить
		c.Set("api_key_id", apiKeyID)

		// Обновляем last_used
		_, _ = db.DB.Exec("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?", apiKeyID)

		c.Next()
	}
}
