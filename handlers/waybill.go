// handlers/waybill.go

package handlers

import (
	"bytes"
	"context"
	"fastalmaty/db"
	"fastalmaty/models"
	"html/template"
	"net/http"
	"os"
	"path/filepath"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gin-gonic/gin"
)

func WaybillHandler(c *gin.Context) {
	orderID := c.Param("id")

	var order models.Order
	err := db.DB.QueryRow(`
		SELECT id, sender_name, sender_phone, sender_address,
		       receiver_name, receiver_phone, receiver_address,
		       description, weight_kg, volume_l, delivery_cost_tenge,
		       payment_method, status, created_at
		FROM orders WHERE id = ?`, orderID).
		Scan(&order.ID, &order.SenderName, &order.SenderPhone, &order.SenderAddress,
			&order.ReceiverName, &order.ReceiverPhone, &order.ReceiverAddress,
			&order.Description, &order.WeightKg, &order.VolumeL, &order.DeliveryCostTenge,
			&order.PaymentMethod, &order.Status, &order.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		return
	}

	pdfPath := filepath.Join("static", "waybills", orderID+".pdf")

	if _, err := os.Stat(pdfPath); err == nil {
		c.JSON(http.StatusOK, gin.H{"pdf_url": "/" + pdfPath})
		return
	}

	if err := generateWaybillPDF(order, pdfPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации PDF"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"pdf_url": "/" + pdfPath})
}

func generateWaybillPDF(order models.Order, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	tmpl, err := template.ParseFiles("templates/waybill.html")
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, order); err != nil {
		return err
	}

	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	var pdfData []byte
	err = chromedp.Run(ctx,
		chromedp.Navigate("about:blank"),
		chromedp.WaitReady("body"),
		// ✅ Правильный способ вставить HTML
		chromedp.Evaluate(`document.write(`+string(buf.String())+`)`, nil),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfData, _, err = page.PrintToPDF().WithPrintBackground(true).Do(ctx)
			return err
		}),
	)
	if err != nil {
		return err
	}

	return os.WriteFile(outputPath, pdfData, 0644)
}
