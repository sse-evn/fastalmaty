package db

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func Init(dbPath string) {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Не удалось открыть базу данных:", err)
	}
	if err = DB.Ping(); err != nil {
		log.Fatal("Не удалось подключиться к базе:", err)
	}
	createTables()
	initUsers()
	log.Println("✅ База данных инициализирована")
}

func Close() {
	if DB != nil {
		_ = DB.Close()
	}
}

func createTables() {
	sqlStmt := `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        created_at TEXT,
        created_by INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        created_at TEXT,
        last_used TEXT,
        created_by INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        sender_name TEXT,
        sender_phone TEXT,
        sender_address TEXT,
        receiver_name TEXT,
        receiver_phone TEXT,
        receiver_address TEXT,
        description TEXT,
        weight_kg REAL,
        volume_l REAL,
        delivery_cost_tenge REAL,
        payment_method TEXT,
        status TEXT,
        created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS clients (
        phone TEXT PRIMARY KEY,
        name TEXT,
        address TEXT,
        last_order_id TEXT,
        total_orders INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    `
	_, err := DB.Exec(sqlStmt)
	if err != nil {
		log.Printf("❌ Ошибка при создании таблиц: %q", err)
	} else {
		log.Println("✅ Таблицы проверены/созданы")
	}
}

func hashPassword(password string) string {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("❌ Не удалось хешировать пароль:", err)
	}
	return string(hashed)
}

func initUsers() {
	users := []struct {
		username string
		password string
		role     string
		name     string
	}{
		{"admin", "admin123", "admin", "Администратор"},
		{"manager", "manager123", "manager", "Менеджер"},
		{"courier1", "courier123", "courier", "Курьер Иван"},
	}
	for _, u := range users {
		var exists int
		err := DB.QueryRow("SELECT 1 FROM users WHERE username = ?", u.username).Scan(&exists)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("⚠️  Ошибка проверки пользователя %s: %v", u.username, err)
			continue
		}
		if err == nil {
			continue // пользователь уже есть
		}
		_, err = DB.Exec(
			"INSERT INTO users (username, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)",
			u.username, hashPassword(u.password), u.role, u.name, time.Now().Format(time.RFC3339),
		)
		if err != nil {
			log.Printf("❌ Не удалось добавить пользователя %s: %v", u.username, err)
		} else {
			log.Printf("✅ Добавлен пользователь: %s", u.username)
		}
	}
}
