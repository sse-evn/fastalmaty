package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"fastalmaty/models"
	"fastalmaty/utils"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func generateOrderID() string {
	return fmt.Sprintf("ORD-%d-%d", time.Now().UnixNano(), rand.Intn(1000))
}

func StatsHandler(c *gin.Context) {
	var stats models.Stats
	db.DB.QueryRow("SELECT COUNT(*) FROM orders").Scan(&stats.Total)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'new'").Scan(&stats.New)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'progress'").Scan(&stats.Progress)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'completed'").Scan(&stats.Completed)
	c.JSON(http.StatusOK, stats)
}

func GetOrdersHandler(c *gin.Context) {
	search := c.Query("search")
	limit := c.DefaultQuery("limit", "")

	query := `SELECT id, receiver_name, receiver_address, status, created_at FROM orders`

	args := []interface{}{}

	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		query += " WHERE receiver_name LIKE ? OR receiver_address LIKE ? OR id LIKE ?"
		args = append(args, search, search, search)
	}

	query += " ORDER BY created_at DESC"

	if limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			query += " LIMIT ?"
			args = append(args, l)
		}
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

		orders = append(orders, gin.H{
			"id":               id,
			"receiver_name":    receiverName,
			"receiver_address": receiverAddress,
			"status":           status,
			"created_at":       createdAt,
			"status_text":      utils.GetStatusText(status),
		})
	}

	c.JSON(http.StatusOK, orders)
}

func CreateOrderHandler(c *gin.Context) {
	var order struct {
		Sender            map[string]string `json:"sender"`
		Receiver          map[string]string `json:"receiver"`
		Package           map[string]string `json:"package"`
		ID                string            `json:"id"`
		DeliveryCostTenge float64           `json:"delivery_cost_tenge"`
		PaymentMethod     string            `json:"payment_method"`
	}

	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}

	if order.ID == "" {
		order.ID = generateOrderID()
	}

	weight, _ := strconv.ParseFloat(order.Package["weight_kg"], 64)
	volume, _ := strconv.ParseFloat(order.Package["volume_l"], 64)

	_, err := db.DB.Exec(`
		INSERT INTO orders (
			id, sender_name, sender_phone, sender_address,
			receiver_name, receiver_phone, receiver_address,
			description, weight_kg, volume_l, delivery_cost_tenge,
			payment_method, status, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		order.ID,
		order.Sender["name"], order.Sender["phone"], order.Sender["address"],
		order.Receiver["name"], order.Receiver["phone"], order.Receiver["address"],
		order.Package["description"], weight, volume,
		order.DeliveryCostTenge, order.PaymentMethod,
		"new", time.Now().Format(time.RFC3339),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Заказ создан", "id": order.ID})
}

func AvailableOrdersHandler(c *gin.Context) {
	query := `
        SELECT id, receiver_name, receiver_address, status, 
               created_at, weight_kg, delivery_cost_tenge 
        FROM orders 
        WHERE status = 'new' OR status = 'progress'
        ORDER BY created_at DESC
    `

	rows, err := db.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"orders": []interface{}{}})
		return
	}
	defer rows.Close()

	var orders []gin.H
	for rows.Next() {
		var id, receiverName, receiverAddress, status, createdAt string
		var weightKg, deliveryCostTenge float64
		var statusNull, createdAtNull sql.NullString
		var weightNull, costNull sql.NullFloat64

		err := rows.Scan(&id, &receiverName, &receiverAddress, &statusNull,
			&createdAtNull, &weightNull, &costNull)
		if err != nil {
			continue
		}

		if statusNull.Valid {
			status = statusNull.String
		}
		if createdAtNull.Valid {
			createdAt = createdAtNull.String
		}
		if weightNull.Valid {
			weightKg = weightNull.Float64
		}
		if costNull.Valid {
			deliveryCostTenge = costNull.Float64
		}

		orders = append(orders, gin.H{
			"id":                  id,
			"receiver_name":       receiverName,
			"receiver_address":    receiverAddress,
			"status":              status,
			"created_at":          createdAt,
			"weight_kg":           weightKg,
			"delivery_cost_tenge": deliveryCostTenge,
		})
	}

	if len(orders) == 0 {
		c.JSON(http.StatusOK, gin.H{"orders": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func CourierOrdersHandler(c *gin.Context) {
	userRole := c.GetString("user_role")
	userID := c.GetInt("user_id")

	var query string
	var args []interface{}

	if userRole == "courier" {
		query = `SELECT id, receiver_name, receiver_address, status, created_at, weight_kg, delivery_cost_tenge
                  FROM orders
                  WHERE courier_id = ? AND status = 'progress'`
		args = append(args, userID)
	} else {
		query = `SELECT id, receiver_name, receiver_address, status, created_at, weight_kg, delivery_cost_tenge
                  FROM orders
                  WHERE status IN ('new', 'progress')`
	}

	rows, err := db.DB.Query(query, args...)
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка чтения данных заказа"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при итерации по заказам"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func TakeOrderHandler(c *gin.Context) {
	orderID := c.Param("id")
	userID := c.GetInt("user_id")

	_, err := db.DB.Exec("UPDATE orders SET courier_id = ?, status = 'progress' WHERE id = ?", userID, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка взятия заказа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ взят"})
}

func ConfirmOrderHandler(c *gin.Context) {
	orderID := c.Param("id")

	_, err := db.DB.Exec("UPDATE orders SET status = 'completed' WHERE id = ?", orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подтверждения заказа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ доставлен"})
}

func ChangeOrderStatusHandler(c *gin.Context) {
	orderID := c.Param("id")
	var request struct {
		Status string `json:"status"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}

	_, err := db.DB.Exec("UPDATE orders SET status = ? WHERE id = ?", request.Status, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка изменения статуса"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Статус изменен"})
}
func DeliverOrderByQRHandler(c *gin.Context) {
	var request struct {
		OrderID string `json:"order_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}
	orderId := request.OrderID
	if orderId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID заказа не указан"})
		return
	}
	var currentStatus string
	err := db.DB.QueryRow("SELECT status FROM orders WHERE id = ?", orderId).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		}
		return
	}
	if currentStatus != "progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заказ не в статусе 'В пути'"})
		return
	}
	_, err = db.DB.Exec("UPDATE orders SET status = 'completed' WHERE id = ?", orderId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления статуса"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Заказ доставлен"})
}
