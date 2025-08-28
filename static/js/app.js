let ordersChart = null;
let apiKeys = [];

/**
 * Показывает страницу по ID
 */
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

/**
 * Вызывает действия при загрузке страницы
 */
function onPageLoad(pageId) {
    switch (pageId) {
        case 'dashboard': updateStats(); break;
        case 'orders': loadAllOrders(); break;
        case 'courier': loadCourierOrders(); break;
        case 'settings': loadSettings(); break;
        case 'admin': loadAdminPanel(); break;
        case 'analytics': initAnalytics(); break;
        case 'new-order': initNewOrderForm(); break;
        case 'clients': searchClient(); break;
    }
}

/**
 * Динамическая загрузка страницы
 */
async function loadPage(pageId) {
    try {
        const res = await fetch(`/templates/${pageId}.html`);
        if (!res.ok) throw new Error('Страница не найдена');
        const container = document.querySelector('.main-content');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = await res.text();
        const newPage = tempDiv.firstElementChild;
        newPage.id = pageId;
        newPage.classList.add('page', 'active');
        container.appendChild(newPage);
        onPageLoad(pageId);
    } catch (err) {
        console.error('Ошибка загрузки страницы:', err);
        showNotification('Ошибка загрузки страницы: ' + err.message, 'error');
    }
}

/**
 * Обновление статистики на дашборде
 */
async function updateStats() {
    try {
        const res = await fetch('/api/stats', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const stats = await res.json();
        setVal('total-orders', stats.total || 0);
        setVal('new-orders', stats.new || 0);
        setVal('progress-orders', stats.progress || 0);
        setVal('completed-orders', stats.completed || 0);
        loadRecentOrders();
    } catch (err) {
        console.error('Ошибка статистики:', err);
        showNotification('Ошибка загрузки статистики', 'error');
    }
}

/**
 * Загрузка последних заказов
 */
async function loadRecentOrders() {
    try {
        const res = await fetch('/api/orders?limit=5', { credentials: 'include' });
        const data = await res.json();
        const orders = Array.isArray(data) ? data : data.orders || [];
        const tbody = document.getElementById('recent-orders');
        if (!tbody) return;
        tbody.innerHTML = orders.length === 0
            ? '<tr><td colspan="5" class="text-center">Нет заказов</td></tr>'
            : orders.map(o => `
                <tr>
                    <td class="order-id">#${o.id || ''}</td>
                    <td>${o.receiver_name || '—'}</td>
                    <td>${o.receiver_address || '—'}</td>
                    <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                    <td>${o.delivery_cost_tenge || 0} ₸</td>
                </tr>
            `).join('');
    } catch (err) {
        console.error('Ошибка загрузки последних заказов:', err);
    }
}

/**
 * Автозаполнение клиента по телефону
 */
function initNewOrderForm() {
    const phone = document.getElementById('receiver-phone');
    if (!phone) return;
    phone.addEventListener('blur', async () => {
        const val = phone.value.trim();
        if (val.length < 10) return;
        try {
            const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(val)}`, { credentials: 'include' });
            if (!res.ok) return;
            const clients = await res.json();
            if (Array.isArray(clients) && clients.length > 0) {
                const c = clients[0];
                setVal('receiver-name', c.name);
                setVal('receiver-address', c.address);
                showNotification('Клиент найден', 'success');
            }
        } catch (err) {
            console.warn('Автозаполнение:', err);
        }
    });
}

/**
 * Очистка формы
 */
function resetForm() {
    const form = document.getElementById('fast-order-form');
    if (form) form.reset();
    showNotification('Форма очищена', 'info');
}

/**
 * Создание нового заказа
 */
async function submitFastOrder() {
    const data = {
        sender_name: getVal('sender-name'),
        sender_phone: getVal('sender-phone'),
        sender_address: getVal('sender-address'),
        receiver_name: getVal('receiver-name'),
        receiver_phone: getVal('receiver-phone'),
        receiver_address: getVal('receiver-address'),
        description: getVal('product-desc'),
        weight_kg: parseFloat(getVal('weight')) || 0,
        volume_l: parseFloat(getVal('volume')) || 0,
        delivery_cost_tenge: parseFloat(getVal('delivery-cost')) || 0,
        payment_method: getVal('payment-method')
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка создания заказа');
        showNotification('Заказ создан', 'success');
        resetForm();
        showPage('dashboard');
    } catch (err) {
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

/**
 * Загрузка всех заказов
 */
async function loadAllOrders() {
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        const data = await res.json();
        const orders = Array.isArray(data) ? data : data.orders || [];
        const tbody = document.getElementById('all-orders');
        if (!tbody) return;
        tbody.innerHTML = orders.length === 0
            ? '<tr><td colspan="6" class="text-center">Нет заказов</td></tr>'
            : orders.map(o => `
                <tr>
                    <td class="order-id">#${o.id}</td>
                    <td>${o.receiver_name}</td>
                    <td>${o.receiver_address}</td>
                    <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                    <td>${formatDate(o.created_at)}</td>
                    <td><button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ PDF</button></td>
                </tr>
            `).join('');
    } catch (err) {
        showNotification('Ошибка загрузки заказов', 'error');
    }
}

/**
 * Поиск заказов
 */
async function searchOrders() {
    const q = getVal('search-input');
    try {
        const res = await fetch(`/api/orders?search=${encodeURIComponent(q)}`, { credentials: 'include' });
        const data = await res.json();
        const orders = Array.isArray(data) ? data : data.orders || [];
        const tbody = document.getElementById('all-orders');
        tbody.innerHTML = orders.length === 0
            ? '<tr><td colspan="6" class="text-center">Не найдено</td></tr>'
            : orders.map(o => `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.receiver_name}</td>
                    <td>${o.receiver_address}</td>
                    <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                    <td>${formatDate(o.created_at)}</td>
                    <td><button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ PDF</button></td>
                </tr>
            `).join('');
    } catch (err) {
        showNotification('Ошибка поиска', 'error');
    }
}

/**
 * Загрузка заказов курьера
 */
async function loadCourierOrders() {
    try {
        const res = await fetch('/api/courier/orders', { credentials: 'include' });
        const data = await res.json();
        const orders = Array.isArray(data) ? data : data.orders || [];
        const tbody = document.getElementById('courier-orders');
        tbody.innerHTML = orders.length === 0
            ? '<tr><td colspan="5" class="text-center">Нет заказов</td></tr>'
            : orders.map(o => `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.receiver_name}</td>
                    <td>${o.receiver_address}</td>
                    <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                    <td><button class="btn btn-success btn-sm" onclick="confirmOrder('${o.id}')">✅</button></td>
                </tr>
            `).join('');
    } catch (err) {
        showNotification('Ошибка загрузки заказов курьера', 'error');
    }
}

/**
 * Поиск клиента
 */
async function searchClient() {
    const phone = getVal('client-search');
    if (phone.length < 3) return;
    try {
        const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`, { credentials: 'include' });
        const clients = await res.json();
        const tbody = document.getElementById('clients-list');
        tbody.innerHTML = Array.isArray(clients) ? clients.map(c => `
            <tr>
                <td>${c.name || '—'}</td>
                <td>${c.phone || '—'}</td>
                <td>${c.address || '—'}</td>
                <td>${c.total_orders || 0}</td>
            </tr>
        `).join('') : '';
    } catch (err) {
        showNotification('Ошибка поиска', 'error');
    }
}

/**
 * Загрузка настроек
 */
async function loadSettings() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const settings = await res.json();

        setVal('setting-company_name', settings.company_name);
        setVal('setting-delivery_price', settings.delivery_price);
        setVal('setting-telegram_bot_token', settings.telegram_bot_token);
        setVal('setting-telegram_chat_id', settings.telegram_chat_id);

        const telegramCheck = document.getElementById('setting-telegram_notifications');
        if (telegramCheck) telegramCheck.checked = settings.telegram_notifications;

        const smsCheck = document.getElementById('setting-sms_notifications');
        if (smsCheck) smsCheck.checked = settings.sms_notifications;

        // API ключ — только для чтения
        setVal('setting-api_key', settings.api_key || 'Не сгенерирован');

    } catch (err) {
        console.error('Ошибка загрузки настроек:', err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

/**
 * Сохранение настроек
 */
async function saveSettings() {
    const settings = {
        company_name: getVal('setting-company_name'),
        delivery_price: parseInt(getVal('setting-delivery_price')) || 500,
        sms_notifications: !!document.getElementById('setting-sms_notifications')?.checked,
        telegram_notifications: !!document.getElementById('setting-telegram_notifications')?.checked,
        telegram_bot_token: getVal('setting-telegram_bot_token'),
        telegram_chat_id: getVal('setting-telegram_chat_id')
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
            credentials: 'include'
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            throw new Error(error.error || 'Ошибка сохранения');
        }

        showNotification('✅ Настройки сохранены', 'success');
    } catch (err) {
        console.error('Ошибка сохранения:', err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

/**
 * Инициализация аналитики
 */
async function initAnalytics() {
    await loadAnalyticsData();
    initCharts();
}

/**
 * Загрузка данных аналитики
 */
async function loadAnalyticsData() {
    try {
        const res = await fetch('/api/analytics/data', { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const data = await res.json();

        setVal('total-orders-stat', data.total_orders || 0);
        setVal('completed-orders-stat', data.completed || 0);
        setVal('in-progress-stat', data.in_progress || 0);
        setVal('cancelled-orders-stat', data.cancelled || 0);
        setVal('revenue-stat', (data.revenue || 0).toLocaleString() + ' ₸');
        setVal('avg-delivery-time', (data.avg_delivery_time || 0).toFixed(1) + ' ч');

        // График заказов по дням
        if (ordersChart && data.days) {
            ordersChart.data.labels = data.days.map(d => d.date);
            ordersChart.data.datasets[0].data = data.days.map(d => d.count);
            ordersChart.update();
        }

        // Топ курьеров
        const tbody = document.getElementById('top-couriers-list');
        if (tbody && data.top_couriers) {
            tbody.innerHTML = data.top_couriers.map(c => `
                <tr>
                    <td>${c.rank}</td>
                    <td>${c.name || '—'}</td>
                    <td>${c.delivered}</td>
                    <td>${c.revenue} ₸</td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error('Ошибка аналитики:', err);
        showNotification('Ошибка загрузки аналитики', 'error');
    }
}

/**
 * Инициализация графиков
 */
function initCharts() {
    const ctx = document.getElementById('orders-by-day');
    if (ctx && !ordersChart) {
        // Заменяем div на canvas
        const parent = ctx.parentElement;
        const canvas = document.createElement('canvas');
        canvas.id = 'orders-by-day';
        parent.replaceChild(canvas, ctx);

        ordersChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Заказы',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

/**
 * Генерация PDF накладной
 */
function generateWaybill(id) {
    window.open(`/api/waybill/${id}`, '_blank');
}

/**
 * Подтверждение заказа курьером
 */
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
        showNotification('Подтверждено', 'success');
        loadCourierOrders();
    })
    .catch(err => {
        console.error('Ошибка подтверждения:', err);
        showNotification('Ошибка сети', 'error');
    });
}

/**
 * Удаление пользователя
 */
function deleteUser(id, username) {
    if (!confirm(`Удалить "${username}"?`)) return;
    fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification('Удалён', 'success');
        loadAdminUsers();
    })
    .catch(err => {
        console.error('Ошибка удаления:', err);
        showNotification('Ошибка сети', 'error');
    });
}

/**
 * Получение цветного бейджа роли
 */
function getRoleBadge(role) {
    const badges = {
        admin: '<span class="badge badge-danger">Админ</span>',
        manager: '<span class="badge badge-warning">Менеджер</span>',
        courier: '<span class="badge badge-info">Курьер</span>'
    };
    return badges[role] || `<span class="badge">${role}</span>`;
}

/**
 * Текст статуса заказа
 */
function getStatusText(status) {
    const map = {
        new: 'Новый',
        progress: 'В пути',
        completed: 'Доставлен',
        cancelled: 'Отменён'
    };
    return map[status] || status;
}

/**
 * Форматирование даты
 */
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/**
 * Показ уведомления
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '8px',
        color: 'white',
        zIndex: '9999',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backgroundColor: {
            success: '#4CAF50',
            error: '#F44336',
            info: '#2196F3'
        }[type] || '#2196F3',
        transition: 'opacity 0.5s ease'
    });
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 500);
    }, 5000);
}

/**
 * Получить значение поля
 */
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

/**
 * Установить значение поля
 */
function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener('DOMContentLoaded', () => {
    // Навигация
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = e.target.closest('[data-page]');
            if (!target) return;
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            target.classList.add('active');
            showPage(target.dataset.page);
        });
    });

    // Открытие модального окна
    window.openAddUserModal = function() {
        const modal = document.getElementById('addUserModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeAddUserModal = function() {
        const modal = document.getElementById('addUserModal');
        const form = document.getElementById('addUserForm');
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
    };

    // Отправка формы создания пользователя
    const form = document.getElementById('addUserForm');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const data = {
                username: getVal('username'),
                password: getVal('password'),
                name: getVal('name'),
                role: getVal('role')
            };
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    credentials: 'include'
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error);
                showNotification('Пользователь создан', 'success');
                closeAddUserModal();
                loadAdminUsers();
            } catch (err) {
                showNotification('Ошибка: ' + err.message, 'error');
            }
        });
    }

    // Раскомментируй или вставь модальное окно, если оно отсутствует
    const modalHtml = `
    <div id="addUserModal" class="modal-overlay" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; padding: 24px; border-radius: 16px; width: 100%; max-width: 500px;">
            <h3>Добавить пользователя</h3>
            <form id="addUserForm">
                <div class="form-group"><label>Логин</label><input type="text" class="form-input" name="username" required /></div>
                <div class="form-group"><label>Пароль</label><input type="password" class="form-input" name="password" required /></div>
                <div class="form-group"><label>Имя</label><input type="text" class="form-input" name="name" required /></div>
                <div class="form-group"><label>Роль</label><select class="form-select" name="role" required><option value="admin">Администратор</option><option value="manager">Менеджер</option><option value="courier">Курьер</option></select></div>
                <div class="action-row" style="margin-top: 16px; display: flex; gap: 8px;">
                    <button type="button" class="btn btn-danger btn-sm" onclick="closeAddUserModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary btn-sm">Создать</button>
                </div>
            </form>
        </div>
    </div>`;
    
    if (!document.getElementById('addUserModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Загрузка главной страницы
    showPage('dashboard');
});

// === АДМИН-ПАНЕЛЬ ===

async function loadAdminPanel() {
    await loadAdminUsers();
    await loadAdminApiKeys();
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const tbody = document.querySelector('#admin-users tbody');
        if (!tbody) return;
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.name}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username}')">🗑️</button></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
        showNotification('Ошибка загрузки', 'error');
    }
}

async function loadAdminApiKeys() {
    try {
        const res = await fetch('/api/admin/api-keys', { credentials: 'include' });
        const data = await res.json();
        const keys = Array.isArray(data.api_keys) ? data.api_keys : [];
        const tbody = document.querySelector('#admin-api-keys tbody');
        if (!tbody) return;
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>
                    <code>${k.key.slice(0, 8)}...${k.key.slice(-8)}</code>
                    <button class="btn btn-sm btn-link" onclick="copyApiKey('${k.key}')">📋</button>
                </td>
                <td>${formatDate(k.created_at)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="revokeApiKey(${k.id})">❌</button></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки ключей:', err);
        showNotification('Ошибка загрузки', 'error');
    }
}

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
        showNotification(`Ключ: ${data.key}`, 'success');
        loadAdminApiKeys();
    })
    .catch(err => {
        console.error('Ошибка генерации:', err);
        showNotification('Ошибка сети', 'error');
    });
}

function copyApiKey(key) {
    if (!key) {
        showNotification('Ключ пустой', 'error');
        return;
    }
    navigator.clipboard.writeText(key)
        .then(() => showNotification('Скопировано', 'success'))
        .catch(() => showNotification('Не удалось скопировать', 'error'));
}

function revokeApiKey(id) {
    if (!confirm('Отозвать ключ?')) return;
    fetch(`/api/admin/revoke-api-key?id=${id}`, { method: 'POST', credentials: 'include' })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showNotification('Ошибка: ' + data.error, 'error');
            return;
        }
        showNotification('Отозван', 'success');
        loadAdminApiKeys();
    })
    .catch(err => {
        console.error('Ошибка отзыва:', err);
        showNotification('Ошибка сети', 'error');
    });
}