// // handlers/courier.go
package handlers

// import (
// 	"database/sql"
// 	"fastalmaty/db"
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// )

// type Order struct {
// 	ID              string `json:"id"`
// 	ReceiverName    string `json:"receiver_name"`
// 	ReceiverAddress string `json:"receiver_address"`
// 	Status          string `json:"status"`
// 	ReceiverPhone   string `json:"receiver_phone"`
// 	CreatedAt       string `json:"created_at"`
// }

// // func CourierOrdersHandler(c *gin.Context) {
// // 	userRole := c.GetString("user_role")
// // 	userID := c.GetInt("user_id")

// // 	var query string
// // 	var args []interface{}

// // 	// Для курьера — только его заказы
// // 	if userRole == "courier" {
// // 		query = `
// // 			SELECT id, receiver_name, receiver_address, status, receiver_phone, created_at
// // 			FROM orders
// // 			WHERE courier_id = ? AND status IN ('assigned', 'in_progress')
// // 		`
// // 		args = append(args, userID)
// // 	} else {
// // 		// Админ/менеджер видят все активные заказы
// // 		query = `
// // 			SELECT id, receiver_name, receiver_address, status, receiver_phone, created_at
// // 			FROM orders
// // 			WHERE status IN ('assigned', 'in_progress')
// // 		`
// // 	}

// // 	rows, err := db.DB.Query(query, args...)
// // 	if err != nil {
// // 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
// // 		return
// // 	}
// // 	defer rows.Close()

// // 	var orders []Order
// // 	for rows.Next() {
// // 		var order Order
// // 		var receiverName, receiverAddress, status, receiverPhone, createdAt sql.NullString

// // 		err := rows.Scan(
// // 			&order.ID,
// // 			&receiverName,
// // 			&receiverAddress,
// // 			&status,
// // 			&receiverPhone,
// // 			&createdAt,
// // 		)
// // 		if err != nil {
// // 			continue
// // 		}

// // 		// Обработка NULL-полей
// // 		if receiverName.Valid {
// // 			order.ReceiverName = receiverName.String
// // 		}
// // 		if receiverAddress.Valid {
// // 			order.ReceiverAddress = receiverAddress.String
// // 		}
// // 		if status.Valid {
// // 			order.Status = status.String
// // 		}
// // 		if receiverPhone.Valid {
// // 			order.ReceiverPhone = receiverPhone.String
// // 		}
// // 		if createdAt.Valid {
// // 			order.CreatedAt = createdAt.String
// // 		}

// // 		orders = append(orders, order)
// // 	}

// // 	if err = rows.Err(); err != nil {
// // 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка чтения данных"})
// // 		return
// // 	}

// // 	c.JSON(http.StatusOK, orders)
// // }
