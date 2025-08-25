// handlers/courier.go

package handlers

import (
	"fastalmaty/db"
	"fastalmaty/utils"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CourierOrdersHandler — возвращает заказы для курьера
func CourierOrdersHandler(c *gin.Context) {
	// ✅ Исправлено: user_id (с подчёркиванием)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неавторизован"})
		return
	}

	// Приводим к int
	courierID, ok := userID.(int)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный ID пользователя"})
		return
	}

	var orders []gin.H
	query := `
		SELECT id, receiver_name, receiver_address, status, created_at
		FROM orders 
		WHERE courier_id = ? AND status IN ('new', 'progress')
		ORDER BY created_at DESC
	`

	rows, err := db.DB.Query(query, courierID)
	if err != nil {
		log.Printf("Ошибка при получении заказов курьера %d: %v", courierID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сервера"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, receiverName, receiverAddress, status, createdAt string
		err := rows.Scan(&id, &receiverName, &receiverAddress, &status, &createdAt)
		if err != nil {
			continue
		}
		orders = append(orders, gin.H{
			"id":               id,
			"receiver_name":    receiverName,
			"receiver_address": receiverAddress,
			"status":           status,
			"created_at":       createdAt,
			"status_text":      utils.GetStatusText(status),
		})
	}

	if err = rows.Err(); err != nil {
		log.Printf("Ошибка при чтении строк: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	c.JSON(http.StatusOK, orders)
}
