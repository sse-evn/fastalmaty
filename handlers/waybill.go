package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"html/template"
	"image/png"
	"log"
	"net/http"
	"strings"
	"time"

	"fastalmaty/db"
	"fastalmaty/models"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/code128"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
)

func generateBarcodeBase64(orderId string) (string, error) {
	code, err := code128.Encode(orderId)
	if err != nil {
		return "", err
	}
	bcode, err := barcode.Scale(code, 150, 50)
	if err != nil {
		var buf bytes.Buffer
		if err := png.Encode(&buf, code); err != nil {
			return "", err
		}
		return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, bcode); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

func generateQRBase64(orderId string) (string, error) {
	qrData := fmt.Sprintf("order:%s", orderId)
	qr, err := qrcode.New(qrData, qrcode.Medium)
	if err != nil {
		return "", err
	}

	qr.DisableBorder = true
	pngData, err := qr.PNG(256)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngData), nil
}

func WaybillHandler(c *gin.Context) {
	orderIDs := []string{}
	if id := c.Param("id"); id != "" {
		orderIDs = append(orderIDs, id)
	} else {
		var req struct {
			OrderIDs []string `json:"order_ids"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
			return
		}
		if len(req.OrderIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Не указаны ID заказов"})
			return
		}
		orderIDs = req.OrderIDs
	}

	var orders []models.Order
	for _, id := range orderIDs {
		var o models.Order
		err := db.DB.QueryRow(`
			SELECT id, sender_name, sender_phone, sender_address,
			       receiver_name, receiver_phone, receiver_address,
			       description, weight_kg, volume_l, delivery_cost_tenge,
			       payment_method, status, created_at
			FROM orders WHERE id = ?`, id).
			Scan(&o.ID, &o.SenderName, &o.SenderPhone, &o.SenderAddress,
				&o.ReceiverName, &o.ReceiverPhone, &o.ReceiverAddress,
				&o.Description, &o.WeightKg, &o.VolumeL, &o.DeliveryCostTenge,
				&o.PaymentMethod, &o.Status, &o.CreatedAt)
		if err != nil {
			if err == sql.ErrNoRows {
				continue
			}
			log.Printf("Ошибка получения заказа %s: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка получения заказа %s", id)})
			return
		}

		qr, err := generateQRBase64(o.ID)
		if err != nil {
			log.Printf("Ошибка генерации QR для заказа %s: %v", o.ID, err)
			o.QrUrl = ""
		} else {
			o.QrUrl = qr
		}

		bc, err := generateBarcodeBase64(o.ID)
		if err != nil {
			log.Printf("Ошибка генерации штрихкода для заказа %s: %v", o.ID, err)
			o.BarcodeUrl = ""
		} else {
			o.BarcodeUrl = bc
		}

		orders = append(orders, o)
	}

	if len(orders) == 0 {
		c.String(http.StatusNotFound, "Заказы не найдены")
		return
	}

	data := struct {
		Orders []models.Order
	}{Orders: orders}

	tmpl, err := template.ParseFiles("templates/waybill.html")
	if err != nil {
		log.Printf("Ошибка парсинга шаблона: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка шаблона"})
		return
	}

	var buf strings.Builder
	if err := tmpl.Execute(&buf, data); err != nil {
		log.Printf("Ошибка выполнения шаблона: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка рендера"})
		return
	}

	htmlContent := buf.String()

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1920, 1080),
	)
	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	var pdf []byte
	err = chromedp.Run(ctx,
		chromedp.Navigate("about:blank"),
		chromedp.WaitReady("body"),
		chromedp.Evaluate("document.write(`"+htmlContent+"`)", nil),
		chromedp.WaitReady(".qr-code"),
		chromedp.Sleep(2*time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var e error
			pdf, _, e = page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(8.27).
				WithPaperHeight(11.69).
				WithMarginTop(0.5).
				WithMarginBottom(0.5).
				WithMarginLeft(0.5).
				WithMarginRight(0.5).Do(ctx)
			return e
		}),
	)
	if err != nil {
		log.Printf("Ошибка генерации PDF: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации PDF"})
		return
	}

	filename := "nakladnaya.pdf"
	if len(orderIDs) == 1 {
		filename = fmt.Sprintf("nakladnaya_%s.pdf", orderIDs[0])
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))
	c.Data(http.StatusOK, "application/pdf", pdf)
}

func ScanBarcodeHandler(c *gin.Context) {
	var request struct {
		OrderID string `json:"order_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}
	orderId := request.OrderID

	if orderId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID заказа не указан"})
		return
	}

	var currentStatus string
	err := db.DB.QueryRow("SELECT status FROM orders WHERE id = ?", orderId).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		} else {
			log.Printf("Ошибка БД при проверке заказа %s: %v", orderId, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		}
		return
	}

	if currentStatus != "new" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заказ не находится в статусе 'Новый' для этой операции", "current_status": currentStatus})
		return
	}

	_, err = db.DB.Exec("UPDATE orders SET status = 'progress' WHERE id = ?", orderId)
	if err != nil {
		log.Printf("Ошибка БД при обновлении статуса заказа %s: %v", orderId, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления статуса"})
		return
	}

	userID := c.GetInt("user_id")
	userRole := c.GetString("user_role")
	log.Printf("Пользователь ID %d (роль: %s) изменил статус заказа %s с 'new' на 'progress' через сканер штрихкода", userID, userRole, orderId)

	c.JSON(http.StatusOK, gin.H{"message": "Статус заказа обновлен", "order_id": orderId, "new_status": "progress"})
}

func HandleQRScan(c *gin.Context) {
	var request struct {
		OrderID string `json:"order_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}
	orderId := request.OrderID
	if orderId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID заказа не указан"})
		return
	}

	userID := c.GetInt("user_id")
	userRole := c.GetString("user_role")

	var currentStatus string
	err := db.DB.QueryRow("SELECT status FROM orders WHERE id = ?", orderId).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Заказ не найден"})
		} else {
			log.Printf("Ошибка БД при проверке заказа %s: %v", orderId, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных"})
		}
		return
	}

	var newStatus string
	var allowed bool
	var message string

	switch currentStatus {
	case "new":
		if userRole == "manager" || userRole == "admin" || userRole == "courier" {
			newStatus = "progress"
			allowed = true
			message = "Статус заказа обновлен с 'новый' на 'в пути'"
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "Ваша роль не позволяет изменить статус заказа с 'новый'"})
			return
		}
	case "progress":
		if userRole == "courier" || userRole == "admin" {
			newStatus = "completed"
			allowed = true
			message = "Статус заказа обновлен с 'в пути' на 'доставлен'"
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "Ваша роль не позволяет изменить статус заказа с 'в пути' на 'доставлен'"})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Невозможно изменить статус заказа со статусом '%s'", currentStatus)})
		return
	}

	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Операция запрещена для вашей роли или текущего статуса заказа"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		log.Printf("Ошибка начала транзакции для заказа %s: %v", orderId, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка базы данных (транзакция)"})
		return
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	_, err = tx.Exec("UPDATE orders SET status = ?, courier_id = COALESCE(courier_id, ?) WHERE id = ?", newStatus, userID, orderId)
	if err != nil {
		log.Printf("Ошибка БД при обновлении статуса заказа %s: %v", orderId, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления статуса"})
		return
	}

	err = tx.Commit()
	if err != nil {
		log.Printf("Ошибка коммита транзакции для заказа %s: %v", orderId, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка фиксации транзакции"})
		return
	}

	log.Printf("Пользователь ID %d (роль: %s) изменил статус заказа %s с '%s' на '%s' через QR-код", userID, userRole, orderId, currentStatus, newStatus)

	c.JSON(http.StatusOK, gin.H{"message": message, "order_id": orderId, "new_status": newStatus})
}
