// runMigrations.go
package main

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

func runMigrations() {
	dbPath := "./fastalmaty.db"
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		log.Println("База данных не существует, миграции не требуются")
		return
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Ошибка открытия базы данных:", err)
	}
	defer db.Close()

	var hasCourierID bool
	err = db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='courier_id'").Scan(&hasCourierID)
	if err != nil {
		log.Fatal("Ошибка проверки courier_id:", err)
	}
	if !hasCourierID {
		_, err = db.Exec("ALTER TABLE orders ADD COLUMN courier_id INTEGER")
		if err != nil {
			log.Fatal("Ошибка добавления courier_id:", err)
		}
		log.Println("✅ Добавлен столбец courier_id в таблицу orders")
	}

	log.Println("✅ Миграции успешно выполнены")
}
