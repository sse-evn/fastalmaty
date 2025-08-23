// handlers/analytics.go
package handlers

import (
	"database/sql"
	"fastalmaty/db"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func GetOrdersByDayHandler(c *gin.Context) {
	rows, err := db.DB.Query(`
        SELECT 
            date(created_at) as day,
            count(*) as count
        FROM orders
        WHERE created_at >= date('now', '-7 days')
        GROUP BY day
        ORDER BY day
    `)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var labels []string
	var values []int

	for rows.Next() {
		var day string
		var count int
		var dayNull sql.NullString
		if err := rows.Scan(&dayNull, &count); err != nil {
			continue
		}
		if dayNull.Valid {
			day = dayNull.String
		} else {
			day = "Неизвестно"
		}
		labels = append(labels, day)
		values = append(values, count)
	}

	// Заполняем пропущенные дни (если за день 0 заказов)
	fillMissingDays(&labels, &values)

	c.JSON(http.StatusOK, gin.H{
		"labels": labels,
		"values": values,
	})
}

// fillMissingDays — заполняет пропущенные дни в диапазоне
func fillMissingDays(labels *[]string, values *[]int) {
	if len(*labels) == 0 {
		return
	}

	layout := "2006-01-02"
	lastDate, _ := time.Parse(layout, (*labels)[len(*labels)-1])

	daysMap := make(map[string]int)
	for i, day := range *labels {
		daysMap[day] = (*values)[i]
	}

	var newLabels []string
	var newValues []int

	for i := 6; i >= 0; i-- {
		targetDate := lastDate.AddDate(0, 0, -i)
		dayStr := targetDate.Format(layout)
		if val, exists := daysMap[dayStr]; exists {
			newLabels = append(newLabels, dayStr)
			newValues = append(newValues, val)
		} else {
			newLabels = append(newLabels, dayStr)
			newValues = append(newValues, 0)
		}
	}

	*labels = newLabels
	*values = newValues
}
