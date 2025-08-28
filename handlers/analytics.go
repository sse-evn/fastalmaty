package handlers

import (
	"fastalmaty/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

// OrdersByDay — данные по заказам по дням
type OrdersByDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// TopCourier — топ курьеров
type TopCourier struct {
	Rank      int    `json:"rank"`
	Name      string `json:"name"`
	Delivered int    `json:"delivered"`
	Revenue   int    `json:"revenue"`
}

// AnalyticsData — основная структура для аналитики
type AnalyticsData struct {
	TotalOrders     int           `json:"total_orders"`
	Completed       int           `json:"completed"`
	InProgress      int           `json:"in_progress"`
	Cancelled       int           `json:"cancelled"`
	Revenue         int           `json:"revenue"`
	AvgDeliveryTime float64       `json:"avg_delivery_time"`
	Days            []OrdersByDay `json:"days"`
	TopCouriers     []TopCourier  `json:"top_couriers"`
}

// GetOrdersByDayData — получает данные по заказам за 7 дней
func GetOrdersByDayData() ([]OrdersByDay, error) {
	var data []OrdersByDay

	query := `
		SELECT DATE(created_at) as date, COUNT(*) as count
		FROM orders
		WHERE created_at >= date('now', '-7 days')
		GROUP BY DATE(created_at)
		ORDER BY date
	`

	rows, err := db.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item OrdersByDay
		if err := rows.Scan(&item.Date, &item.Count); err != nil {
			continue
		}
		data = append(data, item)
	}

	return data, nil
}

// GetTopCouriers — получает топ-5 курьеров
func GetTopCouriers() ([]TopCourier, error) {
	var couriers []TopCourier

	query := `
		SELECT u.name, 
		       COUNT(o.id) as delivered, 
		       COALESCE(SUM(o.delivery_cost_tenge), 0) as revenue
		FROM users u
		LEFT JOIN orders o ON u.id = o.courier_id AND o.status = 'completed'
		WHERE u.role = 'courier'
		GROUP BY u.id, u.name
		ORDER BY delivered DESC
		LIMIT 5
	`

	rows, err := db.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rank := 1
	for rows.Next() {
		var c TopCourier
		c.Rank = rank
		if err := rows.Scan(&c.Name, &c.Delivered, &c.Revenue); err != nil {
			continue
		}
		couriers = append(couriers, c)
		rank++
	}

	return couriers, nil
}

// GetAnalyticsData — хендлер: возвращает всю аналитику
func GetAnalyticsData(c *gin.Context) {
	var data AnalyticsData

	db.DB.QueryRow("SELECT COUNT(*) FROM orders").Scan(&data.TotalOrders)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'completed'").Scan(&data.Completed)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'progress'").Scan(&data.InProgress)
	db.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'cancelled'").Scan(&data.Cancelled)

	db.DB.QueryRow("SELECT COALESCE(SUM(delivery_cost_tenge), 0) FROM orders WHERE status = 'completed'").Scan(&data.Revenue)

	var avgDays float64
	db.DB.QueryRow(`
		SELECT AVG(julianday(completed_at) - julianday(created_at))
		FROM orders
		WHERE completed_at IS NOT NULL
	`).Scan(&avgDays)
	if avgDays > 0 {
		data.AvgDeliveryTime = avgDays * 24
	}

	days, err := GetOrdersByDayData()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка данных по дням"})
		return
	}
	data.Days = days

	topCouriers, err := GetTopCouriers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка топ курьеров"})
		return
	}
	data.TopCouriers = topCouriers

	c.JSON(http.StatusOK, data)
}

// GetOrdersByDayHandler — хендлер: только для графика
func GetOrdersByDayHandler(c *gin.Context) {
	data, err := GetOrdersByDayData()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	c.JSON(http.StatusOK, data)
}
