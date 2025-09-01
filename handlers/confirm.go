// // // handlers/confirm.go

package handlers

// import (
// 	"fastalmaty/db"
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// )

// // import (
// // 	"database/sql"
// // 	"fastalmaty/db"
// // 	"net/http"

// // 	"github.com/gin-gonic/gin"
// // )

// func ConfirmOrderHandler(c *gin.Context) {
// 	orderID := c.Param("id")

// 	_, err := db.DB.Exec("UPDATE orders SET status = 'completed' WHERE id = ?", orderID)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подтверждения заказа"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "Заказ доставлен"})
// }
