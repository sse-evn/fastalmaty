package handlers

import (
	"fastalmaty/db"
	"fastalmaty/models"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func StatsHandler(c *gin.Context) {
	var stats models.Stats
	db.DB.QueryRow("SELECT COUNT(*) FROM orders").Scan(&stats.Total)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'в очереди'").Scan(&stats.New)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'в пути'").Scan(&stats.Progress)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'доставлен'").Scan(&stats.Delivered)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'получен'").Scan(&stats.Completed)

	c.JSON(http.StatusOK, stats)
}

func GetOrdersHandler(c *gin.Context) {
	search := c.Query("search")
	var rows *[]models.Order

	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		rows = queryOrders(`
			SELECT * FROM orders WHERE 
			id LIKE ? OR receiver_name LIKE ? OR receiver_address LIKE ?
			ORDER BY created_at DESC
		`, search, search, search)
	} else {
		rows = queryOrders("SELECT * FROM orders ORDER BY created_at DESC")
	}

	c.JSON(http.StatusOK, rows)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if order.ID == "" {
		order.ID = fmt.Sprintf("ORD-%d", time.Now().Unix())
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
		"в очереди", time.Now().Format(time.RFC3339),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Order created", "id": order.ID})
}

func queryOrders(query string, args ...interface{}) *[]models.Order {
	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return &[]models.Order{}
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		_ = rows.Scan(
			&o.ID, &o.SenderName, &o.SenderPhone, &o.SenderAddress,
			&o.ReceiverName, &o.ReceiverPhone, &o.ReceiverAddress,
			&o.Description, &o.WeightKg, &o.VolumeL, &o.DeliveryCostTenge,
			&o.PaymentMethod, &o.Status, &o.CreatedAt,
		)
		orders = append(orders, o)
	}
	return &orders
}
