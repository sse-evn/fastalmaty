package handlers

import (
	"fastalmaty/db"
	"log"
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

	rows, err := db.DB.Query("SELECT id, username, role, name, created_at FROM users ORDER BY id DESC")
	if err != nil {
		log.Printf("Ошибка при получении пользователей: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer rows.Close()

	var users []gin.H
	for rows.Next() {
		var id int
		var username, role, name, createdAt string
		if err := rows.Scan(&id, &username, &role, &name, &createdAt); err != nil {
			log.Printf("Ошибка при сканировании пользователя: %v", err)
			continue
		}

		users = append(users, gin.H{
			"id":         id,
			"username":   username,
			"role":       role,
			"name":       name,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// CreateUserHandler — создать нового пользователя
func CreateUserHandler(c *gin.Context) {
	session := sessions.Default(c)
	currentUserID := session.Get("user_id").(int)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверные данные запроса"})
		return
	}

	// Проверка на существование пользователя
	var exists bool
	err := db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)", user.Username).Scan(&exists)
	if err != nil {
		log.Printf("Ошибка при проверке существования пользователя: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким именем уже существует"})
		return
	}

	// Хеширование пароля
	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Ошибка хеширования пароля: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания пользователя"})
		return
	}

	// Создание пользователя
	result, err := db.DB.Exec(`
        INSERT INTO users (username, password, role, name, created_by, created_at) 
        VALUES (?, ?, ?, ?, ?, ?)
    `, user.Username, string(hashed), user.Role, user.Name, currentUserID, time.Now().Format(time.RFC3339))

	if err != nil {
		log.Printf("Ошибка при создании пользователя: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания пользователя"})
		return
	}

	userID, _ := result.LastInsertId()
	log.Printf("Администратор ID %d создал нового пользователя: %s (ID: %d)", currentUserID, user.Username, userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Пользователь успешно создан",
		"user_id": userID,
	})
}

// DeleteUserHandler — удалить пользователя
func DeleteUserHandler(c *gin.Context) {
	session := sessions.Default(c)
	currentUserID := session.Get("user_id").(int)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	userID := c.Param("id")

	// Проверка, не пытается ли администратор удалить самого себя
	if userID == string(rune(currentUserID)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Нельзя удалить самого себя"})
		return
	}

	// Проверка существования пользователя
	var exists bool
	err := db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", userID).Scan(&exists)
	if err != nil {
		log.Printf("Ошибка при проверке существования пользователя: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	// Удаление пользователя
	_, err = db.DB.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		log.Printf("Ошибка при удалении пользователя: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка удаления пользователя"})
		return
	}

	log.Printf("Администратор ID %d удалил пользователя ID %s", currentUserID, userID)
	c.JSON(http.StatusOK, gin.H{"message": "Пользователь успешно удалён"})
}

// GetApiKeysHandler — получить список API-ключей
func GetApiKeysHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	rows, err := db.DB.Query("SELECT id, key, created_at, last_used FROM api_keys ORDER BY id DESC")
	if err != nil {
		log.Printf("Ошибка при получении API-ключей: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer rows.Close()

	var keys []gin.H
	for rows.Next() {
		var id int
		var key, createdAt, lastUsed string
		if err := rows.Scan(&id, &key, &createdAt, &lastUsed); err != nil {
			log.Printf("Ошибка при сканировании API-ключа: %v", err)
			continue
		}

		keys = append(keys, gin.H{
			"id":         id,
			"key":        key,
			"created_at": createdAt,
			"last_used":  lastUsed,
		})
	}

	c.JSON(http.StatusOK, gin.H{"api_keys": keys})
}

// GenerateApiKeyHandler — сгенерировать новый API-ключ
func GenerateApiKeyHandler(c *gin.Context) {
	session := sessions.Default(c)
	currentUserID := session.Get("user_id").(int)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	key := generateRandomString(32)
	now := time.Now().Format(time.RFC3339)

	result, err := db.DB.Exec(`
        INSERT INTO api_keys (key, created_at, created_by) 
        VALUES (?, ?, ?)
    `, key, now, currentUserID)

	if err != nil {
		log.Printf("Ошибка при генерации API-ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации ключа"})
		return
	}

	keyID, _ := result.LastInsertId()
	log.Printf("Администратор ID %d сгенерировал новый API-ключ (ID: %d)", currentUserID, keyID)

	c.JSON(http.StatusOK, gin.H{
		"message": "API-ключ успешно сгенерирован",
		"key":     key,
		"key_id":  keyID,
	})
}

// RevokeApiKeyHandler — отозвать API-ключ
func RevokeApiKeyHandler(c *gin.Context) {
	session := sessions.Default(c)
	currentUserID := session.Get("user_id").(int)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	keyID := c.Query("id")
	if keyID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не указан ID ключа"})
		return
	}

	// Проверка существования ключа
	var exists bool
	err := db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM api_keys WHERE id = ?)", keyID).Scan(&exists)
	if err != nil {
		log.Printf("Ошибка при проверке существования API-ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "API-ключ не найден"})
		return
	}

	// Удаление ключа
	_, err = db.DB.Exec("DELETE FROM api_keys WHERE id = ?", keyID)
	if err != nil {
		log.Printf("Ошибка при отзыве API-ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка отзыва ключа"})
		return
	}

	log.Printf("Администратор ID %d отозвал API-ключ ID %s", currentUserID, keyID)
	c.JSON(http.StatusOK, gin.H{"message": "API-ключ успешно отозван"})
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
