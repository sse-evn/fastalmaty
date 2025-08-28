package handlers

import (
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Order struct {
	ID      int    `json:"id"`
	Client  string `json:"client"`
	Address string `json:"address"`
	Status  string `json:"status"`
	Phone   string `json:"phone"`
}

func CourierOrdersHandler(c *gin.Context) {
	userRole := c.GetString("user_role")
	userID := c.GetInt("user_id")

	var query string
	var args []interface{}

	if userRole == "courier" {
		query = "SELECT id, client_name, address, status, phone FROM orders WHERE courier_id = ? AND status IN ('assigned', 'in_progress')"
		args = append(args, userID)
	} else {
		query = "SELECT id, client_name, address, status, phone FROM orders WHERE status IN ('assigned', 'in_progress')"
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.ID, &order.Client, &order.Address, &order.Status, &order.Phone); err != nil {
			continue
		}
		orders = append(orders, order)
	}

	c.JSON(http.StatusOK, orders)
}
