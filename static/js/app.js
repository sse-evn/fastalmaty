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
    }
}

// --- Дашборд ---
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        document.getElementById('total-orders').textContent = stats.total || 0;
        document.getElementById('new-orders').textContent = stats.new || 0;
        document.getElementById('progress-orders').textContent = stats.progress || 0;
        document.getElementById('completed-orders').textContent = stats.completed || 0;
        loadRecentOrders();
    } catch (err) {
        console.error('Ошибка загрузки статистики:', err);
    }
}

// --- Новый заказ (улучшенная форма) ---
function initNewOrderForm() {
    const phoneInput = document.getElementById('receiver-phone');
    if (!phoneInput) return;

    phoneInput.addEventListener('blur', async function() {
        const phone = this.value;
        if (phone.length >= 10) {
            try {
                const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(phone)}`);
                if (!res.ok) return;
                const clients = await res.json();
                if (clients.length > 0) {
                    const c = clients[0];
                    document.getElementById('receiver-name').value = c.name;
                    document.getElementById('receiver-address').value = c.address;
                }
            } catch (err) {
                console.warn('Автозаполнение не удалось');
            }
        }
    });
}

// --- Заказы ---
async function loadAllOrders() {
    try {
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
                    <button class="btn btn-warning btn-sm" onclick="generateWaybill('${o.id}')">🖨️ PDF</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Ошибка загрузки заказов:', err);
    }
}

// --- Курьер ---
async function loadCourierOrders() {
    try {
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
    } catch (err) {
        console.error('Ошибка загрузки заказов курьера:', err);
    }
}

// --- Админ-панель ---
async function loadAdminPanel() {
    await loadAdminUsers();
    await loadAdminApiKeys();
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        const tbody = document.getElementById('admin-users').querySelector('tbody');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.name}</td>
                <td>${u.role}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️ Удалить</button>
                </td>
            </tr>
        `).join('');
        document.getElementById('admin-user-count').textContent = users.length;
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
    }
}

async function loadAdminApiKeys() {
    try {
        const res = await fetch('/api/admin/api-keys');
        const keys = await res.json();
        apiKeys = keys;
        const tbody = document.getElementById('admin-api-keys').querySelector('tbody');
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td><code style="font-size: 12px;">${k.key}</code></td>
                <td>${new Date(k.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="copyApiKey('${k.key}')">📋 Копировать</button>
                    <button class="btn btn-danger btn-sm" onclick="revokeApiKey('${k.key}')">❌ Отозвать</button>
                </td>
            </tr>
        `).join('');
        document.getElementById('admin-api-key-count').textContent = keys.length;
    } catch (err) {
        console.error('Ошибка загрузки API-ключей:', err);
    }
}

// --- API Ключи ---
function generateApiKey() {
    fetch('/api/admin/generate-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
        alert(`Ключ сгенерирован:\n${data.key}`);
        loadAdminApiKeys();
    })
    .catch(err => alert('Ошибка генерации ключа'));
}

function copyApiKey(key) {
    navigator.clipboard.writeText(key).then(() => {
        alert('Ключ скопирован!');
    }).catch(() => {
        prompt('Скопируйте вручную:', key);
    });
}

function revokeApiKey(key) {
    if (confirm('Отозвать этот API-ключ?')) {
        fetch(`/api/admin/revoke-api-key?key=${encodeURIComponent(key)}`, {
            method: 'DELETE',
        })
        .then(() => loadAdminApiKeys())
        .catch(() => alert('Ошибка отзыва'));
    }
}

// --- Модальное окно добавления пользователя ---
function openAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
}

document.getElementById('addUserForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);

    try {
        await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        closeAddUserModal();
        loadAdminUsers();
    } catch (err) {
        alert('Ошибка создания пользователя');
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
        body: JSON.stringify({ action: 'accept' })
    })
    .then(() => loadCourierOrders())
    .catch(() => alert('Ошибка подтверждения'));
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