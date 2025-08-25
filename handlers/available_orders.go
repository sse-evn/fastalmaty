// handlers/available_orders.go

package handlers

import (
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AvailableOrdersHandler — возвращает заказы, доступные для взятия
func AvailableOrdersHandler(c *gin.Context) {
	var orders []gin.H

	query := `
		SELECT 
			id, 
			receiver_name, 
			receiver_address, 
			weight_kg, 
			volume_l,
			delivery_cost_tenge,
			created_at
		FROM orders 
		WHERE status = 'new' 
		ORDER BY created_at ASC
	`

	rows, err := db.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, receiverName, receiverAddress, createdAt string
		var weight, volume, cost float64
		err := rows.Scan(&id, &receiverName, &receiverAddress, &weight, &volume, &cost, &createdAt)
		if err != nil {
			continue
		}

		orders = append(orders, gin.H{
			"id":               id,
			"receiver_name":    receiverName,
			"receiver_address": receiverAddress,
			"weight_kg":        weight,
			"volume_l":         volume,
			"delivery_cost":    cost,
			"created_at":       createdAt,
		})
	}

	c.JSON(http.StatusOK, orders)
}
