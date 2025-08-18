package models

type Client struct {
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	LastOrderID string `json:"last_order_id"`
	TotalOrders int    `json:"total_orders"`
}
