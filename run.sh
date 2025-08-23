#!/bin/bash

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
    echo "Ошибка сборки!"
    exit 1
fi

# 2. Создание бэкапа на сервере
echo "Создание бэкапа..."
ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
  mkdir -p $BACKUP_DIR
  cp $REMOTE_DIR/fastalmaty $BACKUP_DIR/fastalmaty_$TIMESTAMP
  echo "Бэкап создан: $BACKUP_DIR/fastalmaty_$TIMESTAMP"
EOF

# 3. Копирование файлов
echo "Копирование файлов на сервер..."
scp -i $SSH_KEY -P $SERVER_PORT fastalmaty $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/
scp -i $SSH_KEY -P $SERVER_PORT -r static $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/
scp -i $SSH_KEY -P $SERVER_PORT -r templates $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/

# 4. Перезапуск сервиса с проверкой
echo "Перезапуск сервиса..."
ssh -i $SSH_KEY -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
  cd $REMOTE_DIR
  chmod +x fastalmaty
  systemctl restart $SERVICE_NAME
  sleep 5
  
  # Проверка статуса
  if systemctl is-active --quiet $SERVICE_NAME; then
    echo "Сервис успешно запущен"
    systemctl status $SERVICE_NAME --no-pager -l
  else
    echo "Ошибка запуска сервиса!"
    systemctl status $SERVICE_NAME --no-pager -l
    exit 1
  fi
EOF

echo "=== Деплой успешно завершен ==="