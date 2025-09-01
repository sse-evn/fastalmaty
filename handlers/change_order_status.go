// // // handlers/change_order_status.go
package handlers

// import (
// 	"fastalmaty/db"
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// )

// func ChangeOrderStatusHandler(c *gin.Context) {
// 	orderID := c.Param("id")
// 	var request struct {
// 		Status string `json:"status"`
// 	}

// 	if err := c.ShouldBindJSON(&request); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
// 		return
// 	}

// 	_, err := db.DB.Exec("UPDATE orders SET status = ? WHERE id = ?", request.Status, orderID)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка изменения статуса"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "Статус изменен"})
// }
