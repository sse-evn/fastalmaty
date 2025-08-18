package handlers

import (
	"fastalmaty/db"
	"fastalmaty/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func SearchClientHandler(c *gin.Context) {
	phone := c.Query("phone")
	if phone == "" {
		c.JSON(http.StatusOK, []models.Client{})
		return
	}

	rows, err := db.DB.Query("SELECT * FROM clients WHERE phone LIKE ?", "%"+phone+"%")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var clients []models.Client
	for rows.Next() {
		var cl models.Client
		_ = rows.Scan(&cl.Phone, &cl.Name, &cl.Address, &cl.LastOrderID, &cl.TotalOrders)
		clients = append(clients, cl)
	}

	c.JSON(http.StatusOK, clients)
}

func SaveClientHandler(c *gin.Context) {
	var client models.Client
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := db.DB.Exec(`
		INSERT OR REPLACE INTO clients (name, phone, address, last_order_id, total_orders)
		VALUES (?, ?, ?, ?, COALESCE((SELECT total_orders FROM clients WHERE phone = ?), 0) + 1)
	`, client.Name, client.Phone, client.Address, client.LastOrderID, client.Phone)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
