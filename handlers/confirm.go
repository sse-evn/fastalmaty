// handlers/confirm.go

package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ConfirmOrderHandler — подтверждает получение заказа курьером
func ConfirmOrderHandler(c *gin.Context) {
	orderID := c.Param("id") // ✅ Оставляем как строку

	// Получаем user_id из контекста
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неавторизован"})
		return
	}

	courierID, ok := userID.(int)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный ID пользователя"})
		return
	}

	var status string
	err := db.DB.QueryRow("SELECT status FROM orders WHERE id = ?", orderID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	if status != "progress" && status != "new" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заказ нельзя подтвердить"})
		return
	}

	// Обновляем статус и courier_id
	_, err = db.DB.Exec(`
		UPDATE orders 
		SET status = 'completed', 
		    courier_id = ?, 
		    completed_at = datetime('now') 
		WHERE id = ?`, courierID, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить заказ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ успешно подтверждён", "id": orderID})
}
