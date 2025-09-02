// handlers/order_get_handler.go
package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetCourierOrdersHandler(c *gin.Context) {
	userID := c.GetInt("user_id") // Получаем ID текущего пользователя из контекста (предполагается, что middleware RequireAuth установил его)

	query := `
        SELECT id, receiver_name, receiver_address, status, created_at, weight_kg, delivery_cost_tenge
        FROM orders
        WHERE courier_id = ? AND status = 'progress' -- Или status IN ('assigned', 'progress') если есть статус 'Назначен'
        ORDER BY created_at DESC
    `
	rows, err := db.DB.Query(query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer rows.Close()

	var orders []gin.H
	for rows.Next() {
		var id, receiverName, receiverAddress, status, createdAt sql.NullString
		var weightKg, deliveryCostTenge sql.NullFloat64

		err := rows.Scan(&id, &receiverName, &receiverAddress, &status, &createdAt, &weightKg, &deliveryCostTenge)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка чтения данных"})
			return
		}

		orderData := gin.H{
			"id":                  id.String,
			"receiver_name":       receiverName.String,
			"receiver_address":    receiverAddress.String,
			"status":              status.String,
			"created_at":          createdAt.String,
			"weight_kg":           weightKg.Float64,
			"delivery_cost_tenge": deliveryCostTenge.Float64,
		}
		orders = append(orders, orderData)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка итерации по результатам"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
}
