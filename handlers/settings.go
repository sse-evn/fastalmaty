package handlers

import (
	"fastalmaty/db"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func GetSettingsHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Только админ"})
		return
	}

	rows, err := db.DB.Query("SELECT key, value FROM settings")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		_ = rows.Scan(&key, &value)
		settings[key] = value
	}

	c.JSON(http.StatusOK, settings)
}

func SaveSettingsHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Только админ"})
		return
	}

	var settings map[string]string
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for key, value := range settings {
		_, err := tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	_ = tx.Commit()
	c.JSON(http.StatusOK, gin.H{"success": true})
}
