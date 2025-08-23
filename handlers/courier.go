// handlers/courier.go
package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"fastalmaty/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CourierOrdersHandler — получить заказы курьера
func CourierOrdersHandler(c *gin.Context) {
	userID := c.GetInt("user_id")
	role := c.GetString("user_role")

	if userID == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Не авторизован"})
		return
	}

	var query string
	var args []interface{}

	// Админ и менеджер видят все активные заказы
	if role == "admin" || role == "manager" {
		query = `
            SELECT id, receiver_name, receiver_address, status, created_at 
            FROM orders 
            WHERE status = 'progress' 
            ORDER BY created_at DESC
        `
	} else if role == "courier" {
		// Курьер видит только свои заказы
		query = `
            SELECT id, receiver_name, receiver_address, status, created_at 
            FROM orders 
            WHERE courier_id = ? AND status = 'progress' 
            ORDER BY created_at DESC
        `
		args = append(args, userID)
	} else {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer rows.Close()

	var orders []gin.H
	for rows.Next() {
		var id, receiverName, receiverAddress, status, createdAt string
		var statusNull, createdAtNull sql.NullString

		err := rows.Scan(&id, &receiverName, &receiverAddress, &statusNull, &createdAtNull)
		if err != nil {
			continue
		}

		if statusNull.Valid {
			status = statusNull.String
		}
		if createdAtNull.Valid {
			createdAt = createdAtNull.String
		}

		// Форматируем дату
		parsedTime, err := time.Parse(time.RFC3339, createdAt)
		formattedDate := createdAt
		if err == nil {
			formattedDate = parsedTime.Format("02.01.2006 15:04")
		}

		orders = append(orders, gin.H{
			"id":               id,
			"receiver_name":    receiverName,
			"receiver_address": receiverAddress,
			"status":           status,
			"status_text":      utils.GetStatusText(status),
			"created_at":       formattedDate,
		})
	}

	// ✅ Возвращаем массив (никогда не null)
	c.JSON(http.StatusOK, orders)
}

// ConfirmOrderHandler — подтвердить заказ
func ConfirmOrderHandler(c *gin.Context) {
	userID := c.GetInt("user_id")
	orderID := c.Param("id")

	if userID == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Не авторизован"})
		return
	}

	var req struct {
		Action string `json:"action"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}

	if req.Action != "accept" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неизвестное действие"})
		return
	}

	_, err := db.DB.Exec(`
        UPDATE orders 
        SET status = 'completed', 
            courier_id = COALESCE(courier_id, ?) 
        WHERE id = ?
    `, userID, orderID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления заказа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ подтверждён", "id": orderID})
}
