// handlers/take_order.go

package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func TakeOrderHandler(c *gin.Context) {
	orderID := c.Param("id")

	// Получаем ID курьера из сессии
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

	// Начинаем транзакцию
	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}
	defer tx.Rollback()

	// Проверяем, что заказ существует и в статусе 'new'
	var status string
	err = tx.QueryRow("SELECT status FROM orders WHERE id = ?", orderID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		return
	}

	if status != "new" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заказ уже взят или доставлен"})
		return
	}

	// Обновляем: назначаем курьера и статус
	_, err = tx.Exec(`
		UPDATE orders 
		SET status = 'progress', 
		    courier_id = ?, 
		    taken_at = ? 
		WHERE id = ?`, courierID, time.Now().Format(time.RFC3339), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить заказ"})
		return
	}

	// Фиксируем
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заказ успешно взят", "id": orderID})
}
