#!/bin/bash

# Загружаем токен
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ Файл .env не найден!"
  exit 1
fi

# Переменные
SERVER_USER="root"
SERVER_HOST="195.49.212.103"
SERVER_PORT="22"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/home/evn/fastalmaty/fastalmaty"
SERVICE_NAME="fastalmaty"
BACKUP_DIR="/home/evn/fastalmaty/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=== Начало деплоя FastAlmaty ==="

# 1. Проверка сборки
echo "Сборка приложения..."
CGO_ENABLED=0 GOOS=linux go build -o fastalmaty .
if [ $? -ne 0 ]; then
    echo "❌ Ошибка сборки!"
    exit 1
fi
echo "✅ Сборка успешна"

# 2. Создание бэкапа на сервере
echo "Создание бэкапа..."
ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
  mkdir -p $BACKUP_DIR
  if [ -f $REMOTE_DIR/fastalmaty ]; then
    cp $REMOTE_DIR/fastalmaty $BACKUP_DIR/fastalmaty_$TIMESTAMP
    echo "✅ Бэкап создан: $BACKUP_DIR/fastalmaty_$TIMESTAMP"
  else
    echo "ℹ️ Нет старого бинаря — бэкап не требуется"
  fi
EOF

# 3. Копирование файлов
echo "Копирование файлов на сервер..."
scp -i $SSH_KEY -P $SERVER_PORT fastalmaty $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/
scp -i $SSH_KEY -P $SERVER_PORT -r static $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/
scp -i $SSH_KEY -P $SERVER_PORT -r templates $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/
echo "✅ Файлы скопированы"

# 4. Перезапуск сервиса
echo "Перезапуск сервиса..."
ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
  cd $REMOTE_DIR
  chmod +x fastalmaty
  systemctl restart $SERVICE_NAME
  sleep 5
  
  if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ Сервис успешно запущен"
  else
    echo "❌ Ошибка запуска сервиса!"
    systemctl status $SERVICE_NAME --no-pager -l
    exit 1
  fi
EOF

# 5. Пуш в GitHub
echo "⬆️ Отправка в GitHub..."
git remote set-url origin https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$GITHUB_REPO.git
git add .
git commit -m "Deploy $TIMESTAMP" || echo "⚠️ Нет изменений для коммита"
git push origin main || echo "⚠️ Git push завершился с ошибкой"

echo "=== 🚀 Деплой успешно завершен ==="
