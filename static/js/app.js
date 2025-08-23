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
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
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

// Загрузка последних заказов для дашборда
async function loadRecentOrders() {
    try {
        const res = await fetch('/api/orders?limit=5', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const orders = await res.json();

        if (!Array.isArray(orders)) {
            console.error("Ответ не является массивом:", orders);
            showNotification("Ошибка: некорректный ответ от сервера", "error");
            return;
        }

        const tbody = document.getElementById('recent-orders');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Нет заказов</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.id || ''}</td>
                <td>${o.receiver_name || 'Не указан'}</td>
                <td>${o.receiver_address || 'Не указан'}</td>
                <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                <td>${o.delivery_cost_tenge || 0} ₸</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки последних заказов:', err);
        showNotification('Ошибка загрузки последних заказов: ' + err.message, 'error');
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
                if (Array.isArray(clients) && clients.length > 0) {
                    const c = clients[0];
                    document.getElementById('receiver-name').value = c.name || '';
                    document.getElementById('receiver-address').value = c.address || '';
                    showNotification('Данные клиента найдены и заполнены', 'success');
                }
            } catch (err) {
                console.warn('Автозаполнение не удалось:', err);
            }
        }
    });
}

// Очистка формы нового заказа
function resetForm() {
    document.getElementById('fast-order-form').reset();
    showNotification('Форма очищена', 'info');
}

// Отправка формы нового заказа
async function submitFastOrder() {
    const orderData = {
        sender_name: document.getElementById('sender-name').value,
        sender_phone: document.getElementById('sender-phone').value,
        sender_address: document.getElementById('sender-address').value,
        receiver_name: document.getElementById('receiver-name').value,
        receiver_phone: document.getElementById('receiver-phone').value,
        receiver_address: document.getElementById('receiver-address').value,
        description: document.getElementById('product-desc').value,
        weight_kg: parseFloat(document.getElementById('weight').value) || 0,
        volume_l: parseFloat(document.getElementById('volume').value) || 0,
        delivery_cost_tenge: parseFloat(document.getElementById('delivery-cost').value) || 0,
        payment_method: document.getElementById('payment-method').value
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
            credentials: 'include'
        });

        const result = await res.json();

        if (!res.ok) {
            showNotification('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
            return;
        }

        showNotification('Заказ успешно создан', 'success');
        resetForm();
        showPage('dashboard');
    } catch (err) {
        console.error('Ошибка создания заказа:', err);
        showNotification('Ошибка создания заказа: ' + err.message, 'error');
    }
}

// --- Заказы ---
async function loadAllOrders() {
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const orders = await res.json();

        if (!Array.isArray(orders)) {
            console.error("Ответ не является массивом:", orders);
            showNotification("Ошибка: некорректный ответ от сервера", "error");
            return;
        }

        const tbody = document.getElementById('all-orders');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Нет заказов</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="order-id">#${o.id || ''}</td>
                <td>${o.receiver_name || 'Не указан'}</td>
                <td>${o.receiver_address || 'Не указан'}</td>
                <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                <td>${formatDate(o.created_at)}</td>
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

// Поиск заказов
async function searchOrders() {
    const searchTerm = document.getElementById('search-input').value.trim();
    try {
        const res = await fetch(`/api/orders?search=${encodeURIComponent(searchTerm)}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const orders = await res.json();

        if (!Array.isArray(orders)) {
            console.error("Ответ не является массивом:", orders);
            showNotification("Ошибка: некорректный ответ от сервера", "error");
            return;
        }

        const tbody = document.getElementById('all-orders');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Заказы не найдены</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="order-id">#${o.id || ''}</td>
                <td>${o.receiver_name || 'Не указан'}</td>
                <td>${o.receiver_address || 'Не указан'}</td>
                <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                <td>${formatDate(o.created_at)}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ PDF</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка поиска заказов:', err);
        showNotification('Ошибка поиска заказов: ' + err.message, 'error');
    }
}

// --- Курьер ---
async function loadCourierOrders() {
    try {
        const res = await fetch('/api/courier/orders', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);

        const orders = await res.json();

        if (!Array.isArray(orders)) {
            console.error("Ответ не является массивом:", orders);
            showNotification("Ошибка: некорректный ответ от сервера", "error");
            return;
        }

        const tbody = document.getElementById('courier-orders');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Нет заказов в пути</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td class="order-id">#${o.id || ''}</td>
                <td>${o.receiver_name || 'Не указан'}</td>
                <td>${o.receiver_address || 'Не указан'}</td>
                <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
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

// --- CRM ---
async function searchClient() {
    const phone = document.getElementById('client-search').value.trim();
    if (phone.length < 3) {
        document.getElementById('clients-list').innerHTML = '<tr><td colspan="4" class="text-center">Введите минимум 3 символа для поиска</td></tr>';
        return;
    }

    try {
        const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const clients = await res.json();

        if (!Array.isArray(clients)) {
            console.error("Ответ не является массивом:", clients);
            showNotification("Ошибка: некорректный ответ от сервера", "error");
            return;
        }

        const tbody = document.getElementById('clients-list');
        if (!tbody) return;

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Клиенты не найдены</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(c => `
            <tr>
                <td>${c.name || 'Не указан'}</td>
                <td>${c.phone || 'Не указан'}</td>
                <td>${c.address || 'Не указан'}</td>
                <td>${c.total_orders || 0}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка поиска клиентов:', err);
        showNotification('Ошибка поиска клиентов: ' + err.message, 'error');
    }
}

// --- Настройки ---
async function loadSettings() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const settings = await res.json();

        document.getElementById('setting-company_name').value = settings.company_name || '';
        document.getElementById('setting-delivery_price').value = settings.delivery_price || 500;
        document.getElementById('setting-api_key').value = settings.api_key || '';
    } catch (err) {
        console.error('Ошибка загрузки настроек:', err);
        showNotification('Ошибка загрузки настроек: ' + err.message, 'error');
    }
}

async function saveSettings() {
    const settings = {
        company_name: document.getElementById('setting-company_name').value,
        delivery_price: parseFloat(document.getElementById('setting-delivery_price').value) || 500
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
            credentials: 'include'
        });

        const result = await res.json();

        if (!res.ok) {
            showNotification('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
            return;
        }

        showNotification('Настройки успешно сохранены', 'success');
    } catch (err) {
        console.error('Ошибка сохранения настроек:', err);
        showNotification('Ошибка сохранения настроек: ' + err.message, 'error');
    }
}

// --- Аналитика ---
function initChart() {
    const ctx = document.getElementById('ordersChart');
    if (!ctx) return;

    if (ordersChart) {
        ordersChart.destroy();
    }

    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
            datasets: [{
                label: 'Заказы',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    loadChartData();
}

async function loadChartData() {
    try {
        const res = await fetch('/api/analytics/orders-by-day', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        if (ordersChart && Array.isArray(data.labels) && Array.isArray(data.values)) {
            ordersChart.data.labels = data.labels;
            ordersChart.data.datasets[0].data = data.values;
            ordersChart.update();
        }
    } catch (err) {
        console.error('Ошибка загрузки данных для графика:', err);
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
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const tbody = document.querySelector('#admin-users tbody');
        if (!tbody) return;

        document.getElementById('admin-user-count').textContent = users.length;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Нет пользователей</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username || '—'}</td>
                <td>${u.name || '—'}</td>
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
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const data = await res.json();
        const keys = Array.isArray(data.api_keys) ? data.api_keys : [];
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
                    <code>${k.key ? k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 8) : '—'}</code>
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
    return badges[role] || `<span class="badge">${role}</span>`;
}

function getStatusText(status) {
    const statuses = {
        'new': 'Новый',
        'progress': 'В пути',
        'completed': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '300px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#F44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }

    document.body.appendChild(notification);

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
            const target = e.target.closest('[data-page]');
            if (!target) return;
            const page = target.dataset.page;
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            target.classList.add('active');
            showPage(page);
        });
    });

    showPage('dashboard');
});