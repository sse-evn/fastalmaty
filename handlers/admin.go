// handlers/admin.go

package handlers

import (
	"fastalmaty/db"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GetUsersHandler — получить всех пользователей
func GetUsersHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	rows, err := db.DB.Query("SELECT id, username, role, name FROM users")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
		Role     string `json:"role"`
		Name     string `json:"name"`
	}

	for rows.Next() {
		var u struct {
			ID                   int
			Username, Role, Name string
		}
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.Name); err != nil {
			continue
		}
		users = append(users, struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
			Name     string `json:"name"`
		}{
			ID:       u.ID,
			Username: u.Username,
			Role:     u.Role,
			Name:     u.Name,
		})
	}

	c.JSON(http.StatusOK, users)
}

// CreateUserHandler — создать нового пользователя
func CreateUserHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	var user struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Name     string `json:"name"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка хеширования пароля"})
		return
	}

	_, err = db.DB.Exec(`
		INSERT INTO users (username, password, role, name) 
		VALUES (?, ?, ?, ?)
	`, user.Username, string(hashed), user.Role, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания пользователя"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Пользователь создан"})
}

// DeleteUserHandler — удалить пользователя
func DeleteUserHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	id := c.Param("id")
	_, err := db.DB.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Пользователь удалён"})
}

// GetApiKeysHandler — получить список API-ключей
func GetApiKeysHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	rows, err := db.DB.Query("SELECT key, created_at FROM api_keys")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var keys []struct {
		Key       string `json:"key"`
		CreatedAt string `json:"created_at"`
	}

	for rows.Next() {
		var k struct{ Key, CreatedAt string }
		if err := rows.Scan(&k.Key, &k.CreatedAt); err != nil {
			continue
		}
		keys = append(keys, struct {
			Key       string `json:"key"`
			CreatedAt string `json:"created_at"`
		}{
			Key:       k.Key,
			CreatedAt: k.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, keys)
}

// GenerateApiKeyHandler — сгенерировать новый API-ключ
func GenerateApiKeyHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	key := generateRandomString(32)
	_, err := db.DB.Exec(`
		INSERT INTO api_keys (key, created_at) VALUES (?, ?)
	`, key, time.Now().Format(time.RFC3339))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации ключа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"key": key})
}

// RevokeApiKeyHandler — отозвать API-ключ
func RevokeApiKeyHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	key := c.Query("key")
	_, err := db.DB.Exec("DELETE FROM api_keys WHERE key = ?", key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ключ отозван"})
}

// generateRandomString — генерирует случайную строку
func generateRandomString(n int) string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}
