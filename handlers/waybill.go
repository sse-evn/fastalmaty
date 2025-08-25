// handlers/waybill.go

package handlers

import (
	"context"
	"fastalmaty/db"
	"fastalmaty/models"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gin-gonic/gin"
)

// WaybillHandler — возвращает PDF-накладную напрямую
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
		c.String(http.StatusNotFound, "Заказ не найден")
		return
	}

	// Генерируем имя файла
	filename := "ORD-" + orderID + ".pdf"
	pdfPath := filepath.Join("static", "waybills", filename)

	// 1. Если PDF уже есть — отдаем файл
	if file, err := os.Open(pdfPath); err == nil {
		defer file.Close()
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", "inline; filename="+filename)
		c.Status(http.StatusOK)
		io.Copy(c.Writer, file)
		return
	}

	// 2. Если нет — генерируем
	if err := generateWaybillPDF(order, pdfPath); err != nil {
		c.String(http.StatusInternalServerError, "Ошибка генерации PDF: "+err.Error())
		return
	}

	// 3. Отдаем только что сгенерированный PDF
	file, err := os.Open(pdfPath)
	if err != nil {
		c.String(http.StatusInternalServerError, "Ошибка чтения PDF")
		return
	}
	defer file.Close()

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename="+filename)
	c.Status(http.StatusOK)
	io.Copy(c.Writer, file)
}

// generateWaybillPDF — генерирует PDF из HTML-шаблона с помощью chromedp
func generateWaybillPDF(order models.Order, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	// Читаем и рендерим HTML-шаблон
	tmpl, err := template.ParseFiles("templates/waybill.html")
	if err != nil {
		return err
	}

	var buf strings.Builder
	if err := tmpl.Execute(&buf, order); err != nil {
		return err
	}

	htmlContent := buf.String()

	// Настройка chromedp
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	// Таймаут
	ctx, cancel = context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var pdfData []byte
	err = chromedp.Run(ctx,
		chromedp.Navigate("about:blank"),
		chromedp.WaitReady("body"),
		chromedp.Evaluate("document.write(`"+htmlContent+"`)", nil),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfData, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(8.27).   // A4 ширина
				WithPaperHeight(11.69). // A4 высота
				Do(ctx)
			return err
		}),
	)
	if err != nil {
		return err
	}

	// Сохраняем PDF на диск
	return os.WriteFile(outputPath, pdfData, 0644)
}
