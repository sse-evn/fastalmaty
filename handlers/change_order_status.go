// handlers/change_order_status.go
package handlers

import (
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ChangeOrderStatusHandler изменяет статус заказа
// @Summary      Изменить статус заказа
// @Description  Позволяет администратору или менеджеру изменить статус заказа
// @Tags         Orders
// @Accept       json
// @Produce      json
// @Param        id   path      string  true  "ID заказа"
// @Param        status body     struct{ Status string `json:"status"` } true  "Новый статус"
// @Success      200  {object}  map[string]string "message": "Статус заказа обновлён"
// @Failure      400  {object}  map[string]string "error": "Неверный запрос"
// @Failure      404  {object}  map[string]string "error": "Заказ не найден"
// @Failure      500  {object}  map[string]string "error": "Ошибка сервера"
// @Router       /api/order/{id}/status [put]
func ChangeOrderStatusHandler(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID заказа обязателен"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат JSON или отсутствует поле 'status'"})
		return
	}

	if req.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле 'status' не может быть пустым"})
		return
	}

	// Проверяем, существует ли заказ
	var exists bool
	err := db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM orders WHERE id = ?)", orderID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки заказа в БД"})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		return
	}

	// Обновляем статус заказа
	_, err = db.DB.Exec("UPDATE orders SET status = ? WHERE id = ?", req.Status, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления статуса заказа"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Статус заказа обновлён", "order_id": orderID, "new_status": req.Status})
}
