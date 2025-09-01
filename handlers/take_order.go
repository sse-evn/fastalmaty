// // // handlers/take_order.go

package handlers

// import (
// 	"fastalmaty/db"
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// )

// func TakeOrderHandler(c *gin.Context) {
// 	orderID := c.Param("id")
// 	userID := c.GetInt("user_id")

// 	_, err := db.DB.Exec("UPDATE orders SET courier_id = ?, status = 'progress' WHERE id = ?", userID, orderID)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка взятия заказа"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "Заказ взят"})
// }
