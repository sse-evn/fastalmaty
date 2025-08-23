// Глобальные переменные
let ordersChart = null;
let apiKeys = [];

// Переключение страниц
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (!page) {
        loadPage(pageId);
        return;
    }
    page.classList.add('active');
    onPageLoad(pageId);
}

function onPageLoad(pageId) {
    switch (pageId) {
        case 'dashboard': updateStats(); break;
        case 'orders': loadAllOrders(); break;
        case 'courier': loadCourierOrders(); break;
        case 'settings': loadSettings(); break;
        case 'admin': loadAdminPanel(); break;
        case 'analytics': initChart(); break;
        case 'new-order': initNewOrderForm(); break;
    }
}

// Загрузка страницы по AJAX
async function loadPage(pageId) {
    try {
        const res = await fetch(`/templates/${pageId}.html`);
        if (!res.ok) throw new Error('Страница не найдена');
        const container = document.querySelector('.main-content');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = await res.text();
        container.appendChild(tempDiv.firstChild);
        onPageLoad(pageId);
    } catch (err) {
        console.error('Ошибка загрузки страницы:', err);
        showNotification('Ошибка загрузки страницы: ' + err.message, 'error');
    }
}

// --- Дашборд ---
async function updateStats() {
    try {
        const res = await fetch('/api/stats', { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки статистики');
        const stats = await res.json();
        document.getElementById('total-orders').textContent = stats.total || 0;
        document.getElementById('new-orders').textContent = stats.new || 0;
        document.getElementById('progress-orders').textContent = stats.progress || 0;
        document.getElementById('completed-orders').textContent = stats.completed || 0;
        loadRecentOrders();
    } catch (err) {
        console.error('Ошибка загрузки статистики:', err);
        showNotification('Ошибка загрузки статистики: ' + err.message, 'error');
    }
}

// --- Новый заказ (улучшенная форма) ---
function initNewOrderForm() {
    const phoneInput = document.getElementById('receiver-phone');
    if (!phoneInput) return;
    
    phoneInput.addEventListener('blur', async function() {
        const phone = this.value.trim();
        if (phone.length >= 10) {
            try {
                const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`, { credentials: 'include' });
                if (!res.ok) return;
                const clients = await res.json();
                if (clients.length > 0) {
                    const c = clients[0];
                    document.getElementById('receiver-name').value = c.name;
                    document.getElementById('receiver-address').value = c.address;
                    showNotification('Данные клиента найдены и заполнены', 'success');
                }
            } catch (err) {
                console.warn('Автозаполнение не удалось:', err);
            }
        }
    });
}

// --- Заказы ---
async function loadAllOrders() {
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки заказов');
        const orders = await res.json();
        const tbody = document.getElementById('all-orders');
        if (!tbody) return;
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Нет заказов</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="order-id">#${o.id}</td>
                <td>${o.receiver_name}</td>
                <td>${o.receiver_address}</td>
                <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                <td>${new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ PDF</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки заказов:', err);
        showNotification('Ошибка загрузки заказов: ' + err.message, 'error');
    }
}

// --- Курьер ---
async function loadCourierOrders() {
    try {
        const res = await fetch('/api/courier/orders', { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки заказов курьера');
        const orders = await res.json();
        const tbody = document.getElementById('courier-orders');
        if (!tbody) return;
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Нет заказов в пути</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="order-id">#${o.id}</td>
                <td>${o.receiver_name}</td>
                <td>${o.receiver_address}</td>
                <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="confirmOrder('${o.id}')">✅ Подтвердить</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки заказов курьера:', err);
        showNotification('Ошибка загрузки заказов курьера: ' + err.message, 'error');
    }
}

// --- Админ-панель ---
async function loadAdminPanel() {
    await loadAdminUsers();
    await loadAdminApiKeys();
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки пользователей');
        const data = await res.json();
        const users = data.users || [];
        const tbody = document.querySelector('#admin-users tbody');
        if (!tbody) return;
        
        document.getElementById('admin-user-count').textContent = users.length;
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Нет пользователей</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.name}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username}')">🗑️ Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
        showNotification('Ошибка загрузки пользователей: ' + err.message, 'error');
    }
}

async function loadAdminApiKeys() {
    try {
        const res = await fetch('/api/admin/api-keys', { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки API-ключей');
        const data = await res.json();
        const keys = data.api_keys || [];
        apiKeys = keys;
        const tbody = document.querySelector('#admin-api-keys tbody');
        if (!tbody) return;
        
        document.getElementById('admin-api-key-count').textContent = keys.length;
        
        if (keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Нет API-ключей</td></tr>';
            return;
        }
        
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>
                    <code>${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 8)}</code>
                    <button class="btn btn-sm btn-link" onclick="copyApiKey('${k.key}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </td>
                <td>${formatDate(k.created_at)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="revokeApiKey(${k.id})">
                        ❌ Отозвать
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки API-ключей:', err);
        showNotification('Ошибка загрузки API-ключей: ' + err.message, 'error');
    }
}

// --- API Ключи ---
function generateApiKey() {
    fetch('/api/admin/generate-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification(`Ключ сгенерирован: ${data.key}`, 'success');
        loadAdminApiKeys();
    })
    .catch(err => {
        console.error('Ошибка генерации ключа:', err);
        showNotification('Ошибка генерации ключа: ' + err.message, 'error');
    });
}

function copyApiKey(key) {
    navigator.clipboard.writeText(key)
        .then(() => {
            showNotification('API-ключ скопирован в буфер обмена', 'success');
        })
        .catch(err => {
            console.error('Ошибка копирования:', err);
            showNotification('Ошибка копирования ключа', 'error');
        });
}

function revokeApiKey(keyId) {
    if (!confirm('Вы уверены, что хотите отозвать этот API-ключ?')) {
        return;
    }
    
    fetch(`/api/admin/revoke-api-key?id=${keyId}`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification('API-ключ успешно отозван', 'success');
        loadAdminApiKeys();
    })
    .catch(err => {
        console.error('Ошибка отзыва ключа:', err);
        showNotification('Ошибка отзыва ключа: ' + err.message, 'error');
    });
}

// --- Модальное окно добавления пользователя ---
function openAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('addUserForm').reset();
}

document.addEventListener('DOMContentLoaded', function() {
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    credentials: 'include'
                });
                
                const result = await res.json();
                
                if (!res.ok) {
                    showNotification('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
                    return;
                }
                
                showNotification('Пользователь успешно создан', 'success');
                closeAddUserModal();
                loadAdminUsers();
            } catch (err) {
                console.error('Ошибка создания пользователя:', err);
                showNotification('Ошибка создания пользователя: ' + err.message, 'error');
            }
        });
    }
});

// --- Другие функции ---
function generateWaybill(orderID) {
    window.open(`/api/waybill/${orderID}`, '_blank');
}

function confirmOrder(id) {
    fetch(`/api/order/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification('Заказ подтвержден', 'success');
        loadCourierOrders();
    })
    .catch(err => {
        console.error('Ошибка подтверждения заказа:', err);
        showNotification('Ошибка подтверждения заказа: ' + err.message, 'error');
    });
}

function deleteUser(userId, username) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) {
        return;
    }
    
    fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification('Пользователь удален', 'success');
        loadAdminUsers();
    })
    .catch(err => {
        console.error('Ошибка удаления пользователя:', err);
        showNotification('Ошибка удаления пользователя: ' + err.message, 'error');
    });
}

// --- Вспомогательные функции ---
function getRoleBadge(role) {
    const badges = {
        'admin': '<span class="badge badge-danger">Администратор</span>',
        'manager': '<span class="badge badge-warning">Менеджер</span>',
        'courier': '<span class="badge badge-info">Курьер</span>'
    };
    return badges[role] || role;
}

function getStatusText(status) {
    const statuses = {
        'new': 'Новый',
        'progress': 'В пути',
        'completed': 'Завершен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showNotification(message, type) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Добавляем стили для уведомления
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '300px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    // Устанавливаем цвет в зависимости от типа
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#F44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    // Добавляем уведомление на страницу
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 5000);
}

// Навигация
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Исправлено: используем closest, чтобы работало при клике на иконку
            const target = e.target.closest('[data-page]');
            if (!target) return;
            const page = target.dataset.page;
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            target.classList.add('active');
            showPage(page);
        });
    });
    
    // Первая загрузка
    showPage('dashboard');
});