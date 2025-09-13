package utils

import (
	"fmt"
	"net/url"
)

func GenerateQrUrl(orderId string) string {
	data := fmt.Sprintf("order:%s", orderId)
	encodedData := url.QueryEscape(data)
	return fmt.Sprintf("https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=%s", encodedData)
}
