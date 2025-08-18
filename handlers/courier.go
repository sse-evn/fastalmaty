package handlers

import (
	"fastalmaty/db"
	"fastalmaty/models"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func CourierOrdersHandler(c *gin.Context) {
	session := sessions.Default(c)
	role := session.Get("user_role").(string)
	if role != "courier" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	rows, err := db.DB.Query("SELECT * FROM orders WHERE status = 'в пути'")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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

	c.JSON(http.StatusOK, orders)
}

func ConfirmOrderHandler(c *gin.Context) {
	orderID := c.Param("id")
	var req struct{ Action string }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	status := ""
	switch req.Action {
	case "accept":
		status = "доставлен"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неизвестное действие"})
		return
	}

	_, err := db.DB.Exec("UPDATE orders SET status = ? WHERE id = ?", status, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ доставлен"})
}
