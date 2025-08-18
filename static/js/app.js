// Глобальные переменные
let ordersChart = null;

// Переключение страниц
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (pageId === 'dashboard') updateStats();
    if (pageId === 'orders') loadAllOrders();
    if (pageId === 'courier') loadCourierOrders();
    if (pageId === 'settings') loadSettings();
}

// Обновление статистики
async function updateStats() {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('total-orders').textContent = stats.total;
    document.getElementById('new-orders').textContent = stats.new;
    document.getElementById('progress-orders').textContent = stats.progress;
    document.getElementById('completed-orders').textContent = stats.completed;
    loadRecentOrders();
}

// Загрузка последних заказов
async function loadRecentOrders() {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    const tbody = document.getElementById('recent-orders');
    tbody.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
            <td class="order-id">${o.id}</td>
            <td>${o.receiver_name}</td>
            <td>${o.receiver_address}</td>
            <td><span class="status-badge status-new">${o.status}</span></td>
            <td>${o.delivery_cost_tenge} ₸</td>
        </tr>
    `).join('');
}

// Загрузка всех заказов
async function loadAllOrders() {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    const tbody = document.getElementById('all-orders');
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td class="order-id">${o.id}</td>
            <td>${o.receiver_name}</td>
            <td>${o.receiver_address}</td>
            <td><span class="status-badge status-new">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ Накладная</button>
            </td>
        </tr>
    `).join('');
}

// Поиск заказов
function searchOrders() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#all-orders tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// Создание заказа
async function submitFastOrder() {
    const data = {
        sender: {
            name: document.getElementById('sender-name').value,
            phone: document.getElementById('sender-phone').value,
            address: document.getElementById('sender-address').value
        },
        receiver: {
            name: document.getElementById('receiver-name').value,
            phone: document.getElementById('receiver-phone').value,
            address: document.getElementById('receiver-address').value
        },
        package: {
            description: document.getElementById('product-desc').value,
            weight_kg: document.getElementById('weight').value,
            volume_l: document.getElementById('volume').value
        },
        delivery_cost_tenge: parseFloat(document.getElementById('delivery-cost').value),
        payment_method: document.getElementById('payment-method').value
    };

    const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert('Заказ создан!');
        resetForm();
        showPage('dashboard');
        updateStats();
    } else {
        alert('Ошибка создания заказа');
    }
}

function resetForm() {
    document.getElementById('fast-order-form').reset();
}

// Курьер: загрузка заказов
async function loadCourierOrders() {
    const res = await fetch('/api/courier/orders');
    const orders = await res.json();
    const tbody = document.getElementById('courier-orders');
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td class="order-id">${o.id}</td>
            <td>${o.receiver_name}</td>
            <td>${o.receiver_address}</td>
            <td><span class="status-badge status-progress">${o.status}</span></td>
            <td><button class="btn btn-success btn-sm" onclick="confirmOrder('${o.id}')">✅ Подтвердить</button></td>
        </tr>
    `).join('');
}

// Подтверждение доставки
async function confirmOrder(id) {
    const res = await fetch(`/api/order/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
    });
    if (res.ok) {
        alert('Заказ доставлен!');
        loadCourierOrders();
    }
}

// Поиск клиента
async function searchClient() {
    const phone = document.getElementById('client-search').value;
    if (phone.length < 3) return;

    const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`);
    const clients = await res.json();
    const tbody = document.getElementById('clients-list');
    tbody.innerHTML = clients.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td>${c.address}</td>
            <td>${c.total_orders}</td>
        </tr>
    `).join('');
}

// Загрузка настроек
async function loadSettings() {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    document.getElementById('setting-company_name').value = settings.company_name || '';
    document.getElementById('setting-delivery_price').value = settings.delivery_price || '';
    document.getElementById('setting-api_key').value = settings.api_key || '****';
}

// Сохранение настроек
async function saveSettings() {
    const settings = {
        company_name: document.getElementById('setting-company_name').value,
        delivery_price: document.getElementById('setting-delivery_price').value
    };

    const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });

    if (res.ok) {
        alert('Настройки сохранены!');
    } else {
        alert('Ошибка сохранения');
    }
}

// 🖨️ Генерация накладной (PDF)
async function generateWaybill(orderID) {
    try {
        const res = await fetch(`/api/waybill/${orderID}`);
        const data = await res.json();

        if (data.pdf_url) {
            // Открываем PDF в новой вкладке
            window.open(data.pdf_url, '_blank');
        } else {
            alert('❌ Ошибка: ' + (data.error || 'Не удалось сгенерировать накладную'));
        }
    } catch (err) {
        alert('Ошибка подключения к серверу');
        console.error(err);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Навигация
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            showPage(page);
        });
    });

    // Первичная загрузка
    updateStats();
});