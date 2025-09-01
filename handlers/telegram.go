package handlers

// import (
// 	"fmt"
// 	"net/http"
// 	"net/url"
// 	"strings"
// 	"sync"
// )

// var (
// 	tgToken string
// 	tgChat  string
// 	tgMutex sync.RWMutex
// )

// func UpdateTelegramConfig(token, chat string) {
// 	tgMutex.Lock()
// 	defer tgMutex.Unlock()
// 	tgToken = token
// 	tgChat = chat
// }

// func SendTelegram(message string) {
// 	tgMutex.RLock()
// 	token := tgToken
// 	chat := tgChat
// 	tgMutex.RUnlock()

// 	if token == "" || chat == "" {
// 		return
// 	}

// 	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
// 	data := url.Values{}
// 	data.Set("chat_id", chat)
// 	data.Set("text", message)
// 	data.Set("parse_mode", "HTML")

// 	resp, err := http.Post(apiURL, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
// 	if err != nil {
// 		fmt.Printf("❌ Telegram error: %v\n", err)
// 		return
// 	}
// 	resp.Body.Close()
// }
