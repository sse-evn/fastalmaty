// utils/status.go
package utils

// GetStatusText — локализация статуса
func GetStatusText(status string) string {
	switch status {
	case "new":
		return "Новый"
	case "progress":
		return "В пути"
	case "completed":
		return "Доставлен"
	default:
		return status
	}
}
