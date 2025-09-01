// // // handlers/available_orders.go

package handlers

// import (
// 	"database/sql"
// 	"fastalmaty/db"
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// )

// func AvailableOrdersHandler(c *gin.Context) {
// 	query := `
// 		SELECT id, receiver_name, receiver_address, status,
// 			   created_at, weight_kg, delivery_cost_tenge
// 		FROM orders
// 		WHERE status = 'new' OR status = 'progress'
// 		ORDER BY created_at DESC
// 	`

// 	rows, err := db.DB.Query(query)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных: " + err.Error()})
// 		return
// 	}
// 	defer rows.Close()

// 	var orders []gin.H
// 	for rows.Next() {
// 		var id, receiverName, receiverAddress, status, createdAt string
// 		var weightKg, deliveryCostTenge float64
// 		var statusNull, createdAtNull sql.NullString
// 		var weightNull, costNull sql.NullFloat64

// 		err := rows.Scan(&id, &receiverName, &receiverAddress, &statusNull,
// 			&createdAtNull, &weightNull, &costNull)
// 		if err != nil {
// 			continue
// 		}

// 		if statusNull.Valid {
// 			status = statusNull.String
// 		}
// 		if createdAtNull.Valid {
// 			createdAt = createdAtNull.String
// 		}
// 		if weightNull.Valid {
// 			weightKg = weightNull.Float64
// 		}
// 		if costNull.Valid {
// 			deliveryCostTenge = costNull.Float64
// 		}

// 		orders = append(orders, gin.H{
// 			"id":                  id,
// 			"receiver_name":       receiverName,
// 			"receiver_address":    receiverAddress,
// 			"status":              status,
// 			"created_at":          createdAt,
// 			"weight_kg":           weightKg,
// 			"delivery_cost_tenge": deliveryCostTenge,
// 		})
// 	}

// 	c.JSON(http.StatusOK, orders)
// }
