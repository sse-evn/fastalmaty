package handlers

import (
	"fastalmaty/db"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type Settings struct {
	CompanyName           string `json:"company_name"`
	DeliveryPrice         int    `json:"delivery_price"`
	SmsNotifications      bool   `json:"sms_notifications"`
	TelegramNotifications bool   `json:"telegram_notifications"`
	TelegramBotToken      string `json:"telegram_bot_token"`
	TelegramChatID        string `json:"telegram_chat_id"`
}

func GetSettingsHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role")
	if role != "admin" && role != "manager" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	var s Settings
	rows, err := db.DB.Query("SELECT key, value FROM settings")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		_ = rows.Scan(&k, &v)
		settings[k] = v
	}

	s.CompanyName = settings["company_name"]
	s.DeliveryPrice = parseInt(settings["delivery_price"])
	s.SmsNotifications = settings["sms_notifications"] == "true"
	s.TelegramNotifications = settings["telegram_notifications"] == "true"
	s.TelegramBotToken = settings["telegram_bot_token"]
	s.TelegramChatID = settings["telegram_chat_id"]

	c.JSON(http.StatusOK, s)
}

func SaveSettingsHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role")
	if role != "admin" && role != "manager" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	var settings Settings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	bulk := map[string]string{
		"company_name":           settings.CompanyName,
		"delivery_price":         itoa(settings.DeliveryPrice),
		"sms_notifications":      boolStr(settings.SmsNotifications),
		"telegram_notifications": boolStr(settings.TelegramNotifications),
		"telegram_bot_token":     settings.TelegramBotToken,
		"telegram_chat_id":       settings.TelegramChatID,
	}

	for key, value := range bulk {
		_, err = tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DB write error"})
			return
		}
	}

	UpdateTelegramConfig(settings.TelegramBotToken, settings.TelegramChatID)

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func parseInt(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func itoa(n int) string {
	return strconv.Itoa(n)
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
