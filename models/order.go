package models

type Order struct {
	ID                string  `json:"id"`
	SenderName        string  `json:"sender_name"`
	SenderPhone       string  `json:"sender_phone"`
	SenderAddress     string  `json:"sender_address"`
	ReceiverName      string  `json:"receiver_name"`
	ReceiverPhone     string  `json:"receiver_phone"`
	ReceiverAddress   string  `json:"receiver_address"`
	Description       string  `json:"description"`
	WeightKg          float64 `json:"weight_kg"`
	VolumeL           float64 `json:"volume_l"`
	DeliveryCostTenge float64 `json:"delivery_cost_tenge"`
	PaymentMethod     string  `json:"payment_method"`
	Status            string  `json:"status"`
	CreatedAt         string  `json:"created_at"`
}
