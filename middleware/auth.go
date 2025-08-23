package middleware

import (
	"log"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID := session.Get("user_id")
		if userID == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Не авторизован"})
			c.Abort()
			return
		}
		c.Set("user_id", userID)
		c.Set("user_role", session.Get("user_role"))
		c.Next()
	}
}

func RoleRequired(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userRole := session.Get("user_role")
		log.Printf("Проверка доступа: пользователь имеет роль '%v', требуется одна из: %v", userRole, roles)

		if userRole == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Не авторизован"})
			c.Abort()
			return
		}

		for _, role := range roles {
			if userRole == role {
				log.Printf("Доступ разрешен для роли '%v'", userRole)
				c.Next()
				return
			}
		}

		log.Printf("Доступ запрещен для роли '%v'", userRole)
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		c.Abort()
	}
}
