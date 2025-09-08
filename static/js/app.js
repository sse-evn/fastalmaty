let ordersChart = null;
let apiKeys = [];
let currentUserRole = 'courier';

async function getUserRole() {
    try {
        const res = await fetch('/api/session');
        if (res.ok) {
            const data = await res.json();
            currentUserRole = data.role || 'courier';
        }
    } catch (err) {
        console.error('Ошибка получения роли пользователя:', err);
    }
}

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
        case 'courier': loadAvailableOrders(); loadCourierOrders(); break;
        case 'settings': loadSettings(); break;
        case 'admin': loadAdminPanel(); break;
        case 'analytics': initAnalytics(); break;
        case 'new-order': initNewOrderForm(); break;
        case 'clients': searchClient(); break;
    }
}

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

async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const stats = await res.json();
        document.getElementById('total-orders').textContent = stats.total || 0;
        document.getElementById('new-orders').textContent = stats.new || 0;
        document.getElementById('progress-orders').textContent = stats.progress || 0;
        document.getElementById('completed-orders').textContent = stats.completed || 0;
        loadRecentOrders();
    } catch (err) {
        console.error('Ошибка статистики:', err);
        showNotification('Ошибка загрузки статистики', 'error');
    }
}

async function loadRecentOrders() {
    try {
        const res = await fetch('/api/orders?limit=5');
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
                    <td>${(o.delivery_cost_tenge || 0).toLocaleString()} ₸</td>
                </tr>
            `).join('');
    } catch (err) {
        console.error('Ошибка загрузки последних заказов:', err);
    }
}

function initNewOrderForm() {
    const phone = document.getElementById('receiver-phone');
    if (!phone) return;

    phone.addEventListener('blur', async () => {
        const val = phone.value.trim();
        if (val.length < 10) return;

        try {
            const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(val)}`);
            if (!res.ok) return;
            const clients = await res.json();
            if (Array.isArray(clients) && clients.length > 0) {
                const c = clients[0];
                document.getElementById('receiver-name').value = c.name || '';
                document.getElementById('receiver-address').value = c.address || '';
                showNotification('📋 Клиент найден и данные заполнены', 'success');
            }
        } catch (err) {
            console.warn('Автозаполнение клиента:', err);
        }
    });
}

function resetForm() {
    const form = document.getElementById('fast-order-form');
    if (form) {
        form.reset();
    }
    showNotification('🧹 Форма очищена', 'info');
}

async function submitFastOrder() {
    const data = {
        sender: {
            name: document.getElementById('sender-name').value.trim() || "",
            phone: document.getElementById('sender-phone').value.trim() || "",
            address: document.getElementById('sender-address').value.trim() || ""
        },
        receiver: {
            name: document.getElementById('receiver-name').value.trim(),
            phone: document.getElementById('receiver-phone').value.trim(),
            address: document.getElementById('receiver-address').value.trim()
        },
        package: {
            description: document.getElementById('product-desc').value.trim(),
            weight_kg: document.getElementById('weight').value || "0",
            volume_l: document.getElementById('volume').value || "0"
        },
        delivery_cost_tenge: parseFloat(document.getElementById('delivery-cost').value) || 0.0,
        payment_method: document.getElementById('payment-method').value,
        product_cost_tenge: parseFloat(document.getElementById('product-cost').value) || 0.0,
        comment: document.getElementById('order-comment').value.trim() || ""
    };

    if (!data.receiver.name || !data.receiver.phone || !data.receiver.address || !data.package.description) {
        showNotification('Пожалуйста, заполните все обязательные поля (отмечены *).', 'error');
        return;
    }

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (!res.ok) {
            const errorMsg = result.error || result.message || 'Ошибка создания заказа';
            throw new Error(errorMsg);
        }

        showNotification('✅ Заказ успешно создан!', 'success');
        resetForm();
        showPage('dashboard');

    } catch (err) {
        console.error('Ошибка при создании заказа:', err);
        showNotification(`❌ Ошибка: ${err.message}`, 'error');
    }
}

async function loadAllOrders() {
    try {
        const res = await fetch('/api/orders');
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
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">
                            <i class="fas fa-print"></i> PDF
                        </button>
                        ${getChangeStatusDropdown(o.id, o.status)}
                    </td>
                </tr>
            `).join('');
    } catch (err) {
        showNotification('Ошибка загрузки заказов', 'error');
    }
}

function getChangeStatusDropdown(orderId, currentStatus) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        return '';
    }
    const statusOptions = [
        { value: 'new', label: 'Новый' },
        { value: 'progress', label: 'В пути' },
        { value: 'completed', label: 'Доставлен' },
        { value: 'cancelled', label: 'Отменён' }
    ];
    return `
        <div class="dropdown" style="display: inline-block;">
            <button class="btn btn-sm btn-secondary dropdown-toggle" type="button">
                Изменить статус
            </button>
            <div class="dropdown-content">
                ${statusOptions.map(option => 
                    `<a href="#" onclick="changeOrderStatus('${orderId}', '${option.value}'); return false;">${option.label}</a>`
                ).join('')}
            </div>
        </div>
    `;
}

async function changeOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/order/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Ошибка изменения статуса');
        }
        showNotification('Статус изменён', 'success');
        loadAllOrders();
    } catch (err) {
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

function searchOrders() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#all-orders tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

async function loadAvailableOrders() {
    try {
        const res = await fetch('/api/orders/available');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const orders = Array.isArray(data.orders) ? data.orders : [];
        const tbody = document.getElementById('available-orders');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет доступных заказов</td></tr>';
        } else {
            tbody.innerHTML = orders.map(o => `
                <tr>
                    <td>#${o.id || ''}</td>
                    <td>${o.receiver_name || '—'}</td>
                    <td>${o.receiver_address || '—'}</td>
                    <td>${o.weight_kg || 0} кг</td>
                    <td>${(o.delivery_cost_tenge || 0).toLocaleString()} ₸</td>
                    <td>${formatDate(o.created_at)}</td>
                    <td><button class="btn btn-success btn-sm" onclick="takeOrder('${o.id}')">Взять</button></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Ошибка загрузки доступных заказов:', err);
        const tbody = document.getElementById('available-orders');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет доступных заказов</td></tr>';
        }
    }
}

async function loadCourierOrders() {
    try {
        const res = await fetch('/api/courier/orders');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let data;
        try {
            data = await res.json();
        } catch (e) {
            console.warn('Invalid JSON from /api/courier/orders:', await res.text());
            data = [];
        }

        const orders = Array.isArray(data) ? data : (data.orders || []);
        const tbody = document.getElementById('courier-orders');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Нет заказов</td></tr>';
        } else {
            let rowsHtml = '';
            orders.forEach(o => {
                rowsHtml += `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${o.receiver_name || '—'}</td>
                        <td>${o.receiver_address || '—'}</td>
                        <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                        <td>${formatDate(o.created_at)}</td>
                        <td>
                            ${o.status === 'progress' ? 
                                `<button class="btn btn-success btn-sm" onclick="confirmOrder('${o.id}')">Доставлен</button>` : 
                                `<span>${getStatusText(o.status)}</span>`
                            }
                        </td>
                    </tr>
                `;
                if (o.status === 'progress') {
                     rowsHtml += `<tr><td colspan="6">${addQrToOrderDetails(o.id)}</td></tr>`;
                }
            });
            tbody.innerHTML = rowsHtml;
        }
        addQrButtonToCourierUI();
    } catch (err) {
        console.error('Ошибка загрузки заказов курьера:', err);
        showNotification('Ошибка загрузки заказов курьера', 'error');
    }
}

async function takeOrder(orderId) {
    try {
        const res = await fetch(`/api/order/${orderId}/take`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Не удалось взять заказ');
        }
        
        showNotification('Заказ взят!', 'success');
        loadAvailableOrders();
        loadCourierOrders();
        
    } catch (err) {
        console.error('Ошибка взятия заказа:', err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

async function confirmOrder(id) {
    const res = await fetch(`/api/order/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
    });
    if (res.ok) {
        showNotification('Заказ доставлен!', 'success');
        loadCourierOrders();
        loadAvailableOrders();
    } else {
        const data = await res.json();
        showNotification('Ошибка: ' + (data.error || 'Не удалось подтвердить заказ'), 'error');
    }
}

async function searchClient() {
    const phone = document.getElementById('client-search').value;
    if (phone.length < 3) return;
    try {
        const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`);
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

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        
        const settings = await res.json();
        document.getElementById('setting-company_name').value = settings.company_name || '';
        document.getElementById('setting-delivery_price').value = settings.delivery_price || '';
        document.getElementById('setting-telegram_bot_token').value = settings.telegram_bot_token || '';
        document.getElementById('setting-telegram_chat_id').value = settings.telegram_chat_id || '';
        document.getElementById('setting-api_key').value = settings.api_key || '';
        
        const telegramCheck = document.getElementById('setting-telegram_notifications');
        if (telegramCheck) telegramCheck.checked = settings.telegram_notifications || false;
        
        const smsCheck = document.getElementById('setting-sms_notifications');
        if (smsCheck) smsCheck.checked = settings.sms_notifications || false;
        
    } catch (err) {
        console.error('Ошибка загрузки настроек:', err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

async function saveSettings() {
    const settings = {
        company_name: document.getElementById('setting-company_name').value,
        delivery_price: parseInt(document.getElementById('setting-delivery_price').value) || 500,
        sms_notifications: !!document.getElementById('setting-sms_notifications')?.checked,
        telegram_notifications: !!document.getElementById('setting-telegram_notifications')?.checked,
        telegram_bot_token: document.getElementById('setting-telegram_bot_token').value,
        telegram_chat_id: document.getElementById('setting-telegram_chat_id').value,
        api_key: document.getElementById('setting-api_key').value
    };
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
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

function generateApiKey() {
    const newApiKey = 'fastalmaty_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    document.getElementById('setting-api_key').value = newApiKey;
    showNotification('🔑 Новый API ключ сгенерирован', 'info');
}

function copyApiKey() {
    const apiKeyInput = document.getElementById('setting-api_key');
    if (!apiKeyInput || !apiKeyInput.value) {
        showNotification('API ключ пустой', 'error');
        return;
    }
    
    navigator.clipboard.writeText(apiKeyInput.value)
        .then(() => showNotification('✅ API ключ скопирован', 'success'))
        .catch(() => showNotification('❌ Не удалось скопировать', 'error'));
}

async function initAnalytics() {
    await loadAnalyticsData();
    initCharts();
}

async function loadAnalyticsData() {
    try {
        const res = await fetch('/api/analytics/data');
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        const data = await res.json();
        document.getElementById('total-orders-stat').textContent = data.total_orders || 0;
        document.getElementById('completed-orders-stat').textContent = data.completed || 0;
        document.getElementById('in-progress-stat').textContent = data.in_progress || 0;
        document.getElementById('cancelled-orders-stat').textContent = data.cancelled || 0;
        document.getElementById('revenue-stat').textContent = (data.revenue || 0).toLocaleString() + ' ₸';
        document.getElementById('avg-delivery-time').textContent = (data.avg_delivery_time || 0).toFixed(1) + ' ч';
        if (ordersChart && data.days) {
            ordersChart.data.labels = data.days.map(d => d.date);
            ordersChart.data.datasets[0].data = data.days.map(d => d.count);
            ordersChart.update();
        }
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

function initCharts() {
    const ctx = document.getElementById('orders-by-day');
    if (ctx && !ordersChart) {
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

function generateWaybill(id) {
    window.open(`/api/waybill/${id}`, '_blank');
}

function deleteUser(id, username) {
    if (!confirm(`Удалить "${username}"?`)) return;
    fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
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

function getRoleBadge(role) {
    const badges = {
        admin: '<span class="badge badge-danger">Админ</span>',
        manager: '<span class="badge badge-warning">Менеджер</span>',
        courier: '<span class="badge badge-info">Курьер</span>'
    };
    return badges[role] || `<span class="badge">${role}</span>`;
}

function getStatusText(status) {
    const map = {
        new: 'Новый',
        progress: 'В пути',
        completed: 'Доставлен',
        cancelled: 'Отменён'
    };
    return map[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

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

document.addEventListener('DOMContentLoaded', async () => {
    await getUserRole();
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
    
    const fastOrderForm = document.getElementById('fast-order-form');
    if (fastOrderForm) {
        fastOrderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitFastOrder();
        });
    }

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
    const form = document.getElementById('addUserForm');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const data = {
                username: form.username.value,
                password: form.password.value,
                name: form.name.value,
                role: form.role.value
            };
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
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
    showPage('dashboard');
});

async function loadAdminPanel() {
    await loadAdminUsers();
    await loadAdminApiKeys();
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const tbody = document.querySelector('#admin-users tbody');
        if (!tbody) return;
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.name}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username}')"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
        document.getElementById('admin-user-count').textContent = users.length;
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
        showNotification('Ошибка загрузки', 'error');
    }
}

async function loadAdminApiKeys() {
    try {
        const res = await fetch('/api/admin/api-keys');
        const data = await res.json();
        const keys = Array.isArray(data.api_keys) ? data.api_keys : [];
        const tbody = document.querySelector('#admin-api-keys tbody');
        if (!tbody) return;
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>
                    <code>${k.key.slice(0, 8)}...${k.key.slice(-8)}</code>
                    <button class="btn btn-sm btn-link" onclick="copyApiKey('${k.key}')"><i class="fas fa-copy"></i></button>
                </td>
                <td>${formatDate(k.created_at)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="revokeApiKey(${k.id})"><i class="fas fa-times"></i></button></td>
            </tr>
        `).join('');
        document.getElementById('admin-api-key-count').textContent = keys.length;
    } catch (err) {
        console.error('Ошибка загрузки ключей:', err);
        showNotification('Ошибка загрузки', 'error');
    }
}

function generateApiKey() {
    fetch('/api/admin/generate-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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

    fetch(`/api/admin/revoke-api-key?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        showNotification('Ключ отозван', 'success');
        loadAdminApiKeys();
    })
    .catch(err => {
        console.error('Ошибка отзыва ключа:', err);
        showNotification('Ошибка: ' + (err.message || 'Неизвестная ошибка'), 'error');
    });
}

function applyAnalyticsFilters() {
    showNotification('Фильтры применены', 'info');
}
let qrScanner = null;
let currentScannedOrder = null;

// --- Функции QR-сканера ---
function openQrScanner() {
    const modal = document.getElementById('qr-confirmation-modal');
    if (modal) {
        modal.style.display = 'flex';
        initQrScanner();
    }
}

function closeQrScanner() {
    const modal = document.getElementById('qr-confirmation-modal');
    if (modal) modal.style.display = 'none';

    qrScanner = null;
    currentScannedOrder = null;
    const resultDiv = document.getElementById('qr-result');
    if (resultDiv) resultDiv.style.display = 'none';
}

function initQrScanner() {
    const scannerContainer = document.getElementById('qr-scanner-container');
    if (!scannerContainer) return;

    scannerContainer.innerHTML = '<p>Загрузка сканера...</p>';

    if (!('BarcodeDetector' in window)) {
        scannerContainer.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: #dc2626;">❌ Ваш браузер не поддерживает сканирование QR-кодов</p>
                <p>Пожалуйста, используйте современный браузер (Chrome, Edge, Safari)</p>
                <button class="btn btn-primary" onclick="manualOrderInput()">Ввести номер вручную</button>
            </div>
        `;
        return;
    }

    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.autoplay = true;
    scannerContainer.innerHTML = '';
    scannerContainer.appendChild(video);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function(stream) {
            video.srcObject = stream;

            const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });

            function scanFrame() {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    barcodeDetector.detect(video)
                        .then(barcodes => {
                            if (barcodes.length > 0) {
                                const qrData = barcodes[0].rawValue;
                                processQrCode(qrData);
                                return;
                            } else {
                                requestAnimationFrame(scanFrame);
                            }
                        })
                        .catch(err => {
                            console.error('Ошибка сканирования QR:', err);
                             requestAnimationFrame(scanFrame);
                        });
                } else {
                    requestAnimationFrame(scanFrame);
                }
            }

            scanFrame();
        })
        .catch(err => {
            console.error('Ошибка доступа к камере:', err);
            scannerContainer.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="color: #dc2626;">❌ Не удалось получить доступ к камере</p>
                    <p>Разрешите доступ к камере в настройках браузера</p>
                    <button class="btn btn-primary" onclick="manualOrderInput()">Ввести номер вручную</button>
                </div>
            `;
        });
}


function processQrCode(qrData) {
    // Парсим данные из QR (ожидаем формат: "order:ORDER_ID")
    const match = qrData.match(/order:(\w+)/);
    if (!match) {
        showNotification('Неверный формат QR-кода', 'error');
        return;
    }

    const orderId = match[1];
    verifyOrder(orderId);
}

function verifyOrder(orderId) {
    fetch(`/api/order/${orderId}`)
        .then(response => {
            if (!response.ok) {
                 if(response.status === 404) {
                    throw new Error('Заказ не найден');
                 } else {
                     throw new Error(`Ошибка ${response.status}`);
                 }
            }
            return response.json();
        })
        .then(order => {
            currentScannedOrder = order;
            document.getElementById('qr-order-id').textContent = order.id;
            document.getElementById('qr-receiver-name').textContent = order.receiver_name;
            document.getElementById('qr-result').style.display = 'block';
            qrScanner = null;
        })
        .catch(err => {
            console.error('Ошибка проверки заказа:', err);
            showNotification('Ошибка: ' + (err.message || 'Ошибка проверки заказа'), 'error');
        });
}

function confirmQrDelivery() {
    if (!currentScannedOrder || !currentScannedOrder.id) {
        showNotification('Заказ не выбран', 'error');
        return;
    }

    fetch(`/api/order/${currentScannedOrder.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
    })
    .then(response => {
         if (!response.ok) {
             return response.json().then(errData => {throw new Error(errData.error || 'Ошибка подтверждения заказа');});
         }
         return response.json();
    })
    .then(data => {
        showNotification('✅ Заказ подтвержден!', 'success');
        closeQrScanner();
        loadCourierOrders();
        loadAvailableOrders();
    })
    .catch(err => {
        console.error('Ошибка сети или сервера:', err);
        showNotification('Ошибка: ' + (err.message || 'Ошибка сети'), 'error');
    });
}

function manualOrderInput() {
    const orderId = prompt('Введите номер заказа:');
    if (orderId) {
        verifyOrder(orderId.trim());
    }
}
// --- Конец функций QR-сканера ---

// --- Функции для отображения QR-кодов ---
function generateQrCode(orderId) {
    // Генерация QR-кода для заказа с использованием внешнего сервиса
    const qrData = `order:${orderId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    return qrUrl;
}

function addQrToOrderDetails(orderId) {
    const qrUrl = generateQrCode(orderId);
    return `
        <div style="text-align: center; margin: 10px 0; padding: 10px; border-top: 1px dashed #ccc;">
            <h4 style="margin: 5px 0; font-size: 1em;">QR-код для получения</h4>
            <img src="${qrUrl}" alt="QR код заказа ${orderId}" style="max-width: 100%; height: auto; border: 1px solid #eee; padding: 5px; background:white;">
            <p style="font-size: 0.8em; color: #666; margin: 5px 0;">Покажите этот код получателю</p>
        </div>
    `;
}
// --- Конец функций для отображения QR-кодов ---

// --- Изменение loadCourierOrders ---
async function loadCourierOrders() {
    try {
        const res = await fetch('/api/courier/orders');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let data;
        try {
            data = await res.json();
        } catch (e) {
            console.warn('Invalid JSON from /api/courier/orders:', await res.text());
            data = [];
        }

        const orders = Array.isArray(data) ? data : (data.orders || []);
        const tbody = document.getElementById('courier-orders');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Нет заказов</td></tr>';
        } else {
            let rowsHtml = '';
            orders.forEach(o => {
                // Строка заказа
                rowsHtml += `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${o.receiver_name || '—'}</td>
                        <td>${o.receiver_address || '—'}</td>
                        <td><span class="status-badge status-${o.status || 'new'}">${getStatusText(o.status)}</span></td>
                        <td>${formatDate(o.created_at)}</td>
                        <td>
                            ${o.status === 'progress' ?
                                `<div style="display: flex; flex-direction: column; gap: 5px;">
                                    <button class="btn btn-success btn-sm" onclick="openQrScanner()" title="Сканировать QR для подтверждения">Подтвердить</button>
                                    ${addQrToOrderDetails(o.id)}
                                </div>` :
                                `<span>${getStatusText(o.status)}</span>`
                            }
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = rowsHtml;
        }
        // Добавляем кнопку сканирования QR, если она еще не добавлена
        addQrButtonToCourierUI();
    } catch (err) {
        console.error('Ошибка загрузки заказов курьера:', err);
        showNotification('Ошибка загрузки заказов курьера: ' + err.message, 'error');
    }
}
// --- Конец изменения loadCourierOrders ---

// --- Дополнительная функция для кнопки сканирования ---
function addQrButtonToCourierUI() {
    const courierPage = document.getElementById('courier');
    if (courierPage) {
        const header = courierPage.querySelector('.page-header');
        if (header && !document.getElementById('qr-scan-btn')) {
            const qrButton = document.createElement('button');
            qrButton.id = 'qr-scan-btn';
            qrButton.className = 'btn btn-primary';
            qrButton.innerHTML = '<i class="fas fa-qrcode"></i> Сканировать QR';
            qrButton.onclick = openQrScanner;
            // Добавляем кнопку в начало заголовка
            header.insertBefore(qrButton, header.firstChild);
        }
    }
}
function addQrToOrderDetails(orderId) {
    const qrUrl = generateQrCode(orderId);
    return `
        <div style="text-align: center; margin: 10px 0; padding: 10px; border-top: 1px dashed #ccc;">
            <h4 style="margin: 5px 0; font-size: 1em;">QR-код для получения</h4>
            <img src="${qrUrl}" alt="QR код заказа ${orderId}" style="max-width: 100%; height: auto; border: 1px solid #eee; padding: 5px; background:white;">
            <p style="font-size: 0.8em; color: #666; margin: 5px 0;">Покажите этот код получателю</p>
        </div>
    `;
}
async function loadKaspiOrders() {
    showNotification('Загружаем заказы из Kaspi...', 'info');

    const selectedState = document.getElementById('kaspi-status-filter').value;
    const token = getKaspiAuthToken(); // Реализуйте эту функцию для получения токена (например, из localStorage или настроек)

    if (!token) {
        showNotification('Токен Kaspi не настроен. Перейдите в Настройки.', 'error');
        return;
    }

    const url = `https://kaspi.kz/shop/api/v2/orders?page[number]=0&page[size]=50&filter[orders][state]=${selectedState}&include[orders]=user`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'X-Auth-Token': token
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка API Kaspi: ${response.status}`);
        }

        const data = await response.json();
        renderKaspiOrders(data.data);
        showNotification(`Загружено ${data.data.length} заказов.`, 'success');
    } catch (error) {
        console.error('Ошибка при загрузке заказов Kaspi:', error);
        showNotification('Не удалось загрузить заказы: ' + error.message, 'error');
    }
}

// Функция для отображения заказов в таблице
function renderKaspiOrders(orders) {
    const tableBody = document.getElementById('kaspi-orders-list');
    tableBody.innerHTML = '';

    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Заказы не найдены</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');

        // Форматируем дату создания
        const creationDate = new Date(order.attributes.creationDate).toLocaleString('ru-RU');

        row.innerHTML = `
            <td>${order.attributes.code}</td>
            <td>${order.attributes.customer.firstName} ${order.attributes.customer.lastName}<br><small>${order.attributes.customer.cellPhone}</small></td>
            <td>${order.attributes.deliveryAddress || 'Самовывоз'}</td>
            <td><span class="badge badge-info">${order.attributes.state}</span></td>
            <td><span class="badge badge-warning">${order.attributes.status}</span></td>
            <td>${order.attributes.totalPrice.toLocaleString()} ₸</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="importKaspiOrder('${order.id}')">
                    <i class="fas fa-plus"></i> Импорт
                </button>
                <a href="${order.attributes.waybill}" target="_blank" class="btn btn-sm btn-info" title="Скачать накладную">
                    <i class="fas fa-print"></i>
                </a>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Функция для импорта одного заказа в FastAlmaty
function importKaspiOrder(kaspiOrderId) {
    showNotification('Импорт заказа в разработке...', 'info');
    // Здесь должна быть логика:
    // 1. Получить полные данные заказа по ID (если нужно).
    // 2. Создать новый объект заказа в формате FastAlmaty.
    // 3. Отправить POST-запрос на ваш внутренний API для создания заказа.
    // 4. Показать уведомление об успехе/ошибке.
}

// Функция для массовой синхронизации
function syncAllToFastAlmaty() {
    showNotification('Массовая синхронизация в разработке...', 'info');
    // Логика: пройтись по всем строкам таблицы и вызвать importKaspiOrder для каждого.
}

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Заглушка для получения токена
function getKaspiAuthToken() {
    // В реальности, токен должен храниться в настройках (вкладка Settings)
    // Например, вы можете добавить поле в settings-grid:
    // <input type="text" class="form-input" id="setting-kaspi_api_token" placeholder="X-Auth-Token от Kaspi">
    // И затем вернуть его значение оттуда.
    return localStorage.getItem('kaspi_api_token') || 'YOUR_TEMP_TOKEN_HERE';
}