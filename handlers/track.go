// handlers/track.go
package handlers

import (
	"fastalmaty/db"
	"fastalmaty/utils"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// TrackByPhoneHandler — возвращает заказы по телефону получателя
func TrackByPhoneHandler(c *gin.Context) {
	phone := c.Query("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Требуется параметр phone"})
		return
	}

	// Очистка номера: оставить только цифры
	phone = cleanPhone(phone)

	var orders []struct {
		ID              int    `json:"id"`
		ReceiverName    string `json:"receiver_name"`
		ReceiverAddress string `json:"receiver_address"`
		Status          string `json:"status"`
		CreatedAt       string `json:"created_at"`
		StatusText      string `json:"status_text"`
	}

	query := `
		SELECT id, receiver_name, receiver_address, status, created_at
		FROM orders
		WHERE REPLACE(REPLACE(receiver_phone, '+', ''), ' ', '') = ?
		ORDER BY created_at DESC
	`

	rows, err := db.DB.Query(query, phone)
	if err != nil {
		log.Printf("Ошибка при поиске заказов по телефону %s: %v", phone, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сервера"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var o struct {
			ID              int
			ReceiverName    string
			ReceiverAddress string
			Status          string
			CreatedAt       string
		}
		if err := rows.Scan(&o.ID, &o.ReceiverName, &o.ReceiverAddress, &o.Status, &o.CreatedAt); err != nil {
			continue
		}
		orders = append(orders, struct {
			ID              int    `json:"id"`
			ReceiverName    string `json:"receiver_name"`
			ReceiverAddress string `json:"receiver_address"`
			Status          string `json:"status"`
			CreatedAt       string `json:"created_at"`
			StatusText      string `json:"status_text"`
		}{
			ID:              o.ID,
			ReceiverName:    o.ReceiverName,
			ReceiverAddress: o.ReceiverAddress,
			Status:          o.Status,
			CreatedAt:       o.CreatedAt,
			StatusText:      utils.GetStatusText(o.Status),
		})
	}

	if err = rows.Err(); err != nil {
		log.Printf("Ошибка при чтении строк: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	// ✅ Всегда возвращаем массив, даже если пустой
	c.JSON(http.StatusOK, orders)
}

// cleanPhone — очищает номер от +, пробелов, скобок
func cleanPhone(phone string) string {
	phone = strings.ReplaceAll(phone, "+", "")
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")
	phone = strings.ReplaceAll(phone, "-", "")
	return phone
}
