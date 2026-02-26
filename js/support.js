/* ============================================================
   SUPPORT CENTER – support.js
   GenziKart.in
   ============================================================ */

/**
 * Toast notification – redirected to centralized showToast in utils.js
 */
function showSupportToast(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else {
        alert(message);
    }
}

/* ------------------------------------------------
   1. LOAD USER PROFILE
   ------------------------------------------------ */
async function loadUserProfile() {
    const token = localStorage.getItem('token');
    const userEmail = localStorage.getItem('userEmail');

    // Greeting elements
    const greetName = document.getElementById('userNameGreeting');

    // Sidebar elements
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarEmail = document.getElementById('sidebarEmail');

    if (!token) {
        renderGuestProfile();
        return;
    }

    try {
        // Use decentralized apiFetch from utils.js
        const users = await apiFetch('/users');
        const user = Array.isArray(users) ? users.find(u => u.email === userEmail) : null;

        if (user) {
            renderProfile(user);
        } else {
            renderGuestProfile();
            if (userEmail) {
                if (greetName) greetName.textContent = userEmail.split('@')[0];
                if (sidebarName) sidebarName.textContent = userEmail.split('@')[0];
                if (sidebarEmail) sidebarEmail.textContent = userEmail;
            }
        }
    } catch (err) {
        console.error('Profile load error:', err);
        renderGuestProfile();
    }
}

function renderProfile(user) {
    const greetName = document.getElementById('userNameGreeting');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarEmail = document.getElementById('sidebarEmail');

    const displayName = user.name || user.email.split('@')[0];

    if (greetName) greetName.textContent = displayName;
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarEmail) sidebarEmail.textContent = user.email;

    // Avatar emoji from localStorage
    const savedAvatar = localStorage.getItem('avatar') || '🧑‍💼';
    if (sidebarAvatar) sidebarAvatar.textContent = savedAvatar;
}

function renderGuestProfile() {
    const greetName = document.getElementById('userNameGreeting');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarEmail = document.getElementById('sidebarEmail');

    if (greetName) greetName.textContent = 'Guest';
    if (sidebarName) sidebarName.textContent = 'Guest User';
    if (sidebarEmail) sidebarEmail.textContent = 'Not logged in';

    const badge = document.getElementById('verifiedBadge');
    if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold';
        badge.innerHTML = '<i class="fas fa-user-circle"></i> Guest Mode';
    }
}

/* ------------------------------------------------
   2. LOAD ORDERS
   ------------------------------------------------ */
async function loadOrders() {
    const container = document.getElementById('recentOrdersContainer');
    const token = localStorage.getItem('token');

    if (!token) {
        if (container) {
            container.innerHTML = `
                <div class="p-12 text-center text-slate-500">
                    <i class="fas fa-lock text-4xl mb-4 block opacity-20"></i>
                    <p class="font-bold text-lg mb-2">Login to view orders</p>
                    <p class="text-sm mb-6">You need to be logged in to track your purchase history.</p>
                    <a href="login.html" class="inline-block bg-amber-500 text-white px-8 py-3 rounded-2xl font-bold">Login Now</a>
                </div>
            `;
        }
        return;
    }

    try {
        const orders = await apiFetch('/orders');
        const userEmail = localStorage.getItem('userEmail');
        const myOrders = Array.isArray(orders)
            ? orders.filter(o => !userEmail || o.email === userEmail).slice(0, 5)
            : [];

        if (!container) return;

        if (!myOrders.length) {
            container.innerHTML = `
                <div class="p-12 text-center text-slate-400">
                    <i class="fas fa-box-open text-4xl mb-4 block opacity-20"></i>
                    <p class="font-bold">No orders found yet</p>
                    <a href="products.html" class="text-amber-500 font-bold mt-2 inline-block">Start Shopping</a>
                </div>
            `;
            return;
        }

        container.innerHTML = myOrders.map(order => createOrderRow(order)).join('');

    } catch (err) {
        console.error('Orders load error:', err);
        if (container) {
            container.innerHTML = `
                <div class="p-12 text-center text-red-400">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4 block"></i>
                    <p>Failed to load orders. Please refresh.</p>
                </div>
            `;
        }
    }
}

function createOrderRow(order) {
    const status = (order.status || 'Processing').toLowerCase();
    const statusClass = `status-${status}`;

    // Formatting total
    const total = typeof order.total === 'number' ? `₹${order.total.toLocaleString('en-IN')}` : order.total || '—';

    return `
        <div class="p-6 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                    <i class="fas fa-box"></i>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${order.id || 'Order ID'}</h4>
                    <p class="text-xs text-slate-400">${order.date || ''}</p>
                </div>
            </div>
            <div class="flex items-center gap-4 justify-between sm:justify-end flex-1">
                <div class="text-right">
                    <p class="font-bold text-slate-800">${total}</p>
                    <span class="status-pill ${statusClass}">${order.status || 'Processing'}</span>
                </div>
                <button onclick="prefillTrack('${order.id}')" class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-amber-500 hover:text-white transition-all">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        </div>
    `;
}

/* ------------------------------------------------
   3. ORDER TRACKING
   ------------------------------------------------ */
async function trackOrder() {
    const input = document.getElementById('trackOrderInput');
    const orderId = input?.value?.trim();
    if (!orderId) { showSupportToast('Please enter an Order ID', 'error'); return; }

    const result = document.getElementById('trackResult');
    if (result) {
        result.innerHTML = '<div class="flex items-center gap-2 py-2"><i class="fas fa-spinner fa-spin"></i> Finding your order...</div>';
        result.classList.remove('hidden');
    }

    try {
        const orders = await apiFetch('/orders');
        const order = Array.isArray(orders) ? orders.find(o =>
            o.id?.toLowerCase() === orderId.toLowerCase()
        ) : null;

        if (!order) {
            showSupportToast('Order not found. Check the Order ID.', 'error');
            if (result) result.classList.add('hidden');
            return;
        }

        renderTrackResult(order);
    } catch (err) {
        console.error('Track error:', err);
        showSupportToast('Connection error. Please try again.', 'error');
        if (result) result.classList.add('hidden');
    }
}

function renderTrackResult(order) {
    const result = document.getElementById('trackResult');
    if (!result) return;

    result.classList.remove('hidden');
    const statusIndex = ['pending', 'processing', 'shipped', 'delivered'].indexOf((order.status || '').toLowerCase());

    const steps = ['Pending', 'Processing', 'Shipped', 'Delivered'].map((step, i) => {
        const isDone = i < statusIndex;
        const isActive = i === statusIndex;
        return `
            <div class="flex flex-col items-center gap-1">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}">
                    ${isDone ? '<i class="fas fa-check"></i>' : i + 1}
                </div>
                <span class="text-[10px] ${isActive ? 'font-bold text-blue-600' : 'text-slate-400'}">${step}</span>
            </div>
        `;
    }).join('<div class="h-[2px] flex-1 bg-slate-200 mt-3"></div>');

    result.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Status</p>
                <h4 class="font-black text-slate-800">${order.status || 'Processing'}</h4>
            </div>
            <button onclick="document.getElementById('trackResult').classList.add('hidden')" class="text-slate-300 hover:text-slate-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="flex items-start justify-between">
            ${steps}
        </div>
    `;
}

function prefillTrack(orderId) {
    const input = document.getElementById('trackOrderInput');
    if (input) {
        input.value = orderId;
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        trackOrder();
    }
}

/* ------------------------------------------------
   4. RETURN MODAL
   ------------------------------------------------ */
function openReturnModal() {
    if (!localStorage.getItem('token')) {
        showSupportToast('Please login first to request a return', 'error');
        return;
    }
    const m = document.getElementById('returnModal');
    if (m) { m.style.display = 'flex'; }
}

function closeReturnModal() {
    const m = document.getElementById('returnModal');
    if (m) { m.style.display = 'none'; }
}

function submitReturn(e) {
    e.preventDefault();
    const orderId = document.getElementById('returnOrderId')?.value?.trim();
    const reason = document.getElementById('returnReason')?.value;

    if (!orderId || !reason) { showSupportToast('Please fill all required fields', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    setTimeout(() => {
        showSupportToast('✅ Return request submitted! Processing in 2-3 days.', 'success');
        closeReturnModal();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Submit Return Request <i class="fas fa-paper-plane ml-2"></i>';
        }
        e.target.reset();
    }, 1500);
}

/* ------------------------------------------------
   5. TICKET MODAL
   ------------------------------------------------ */
function openTicketModal() {
    const m = document.getElementById('ticketModal');
    if (m) { m.style.display = 'flex'; }
}

function closeTicketModal() {
    const m = document.getElementById('ticketModal');
    if (m) { m.style.display = 'none'; }
}

function submitTicket(e) {
    e.preventDefault();
    const type = document.getElementById('ticketType')?.value;
    const subject = document.getElementById('ticketSubject')?.value?.trim();
    const details = document.getElementById('ticketDetails')?.value?.trim();

    if (!type || !subject || !details) { showSupportToast('Please fill all fields', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    setTimeout(() => {
        showSupportToast('✅ Ticket submitted! We\'ll reply within 24 hours.', 'success');
        closeTicketModal();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Submit Ticket <i class="fas fa-paper-plane ml-2"></i>';
        }
        document.getElementById('ticketForm')?.reset();
    }, 1500);
}

/* ------------------------------------------------
   INIT
   ------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    // Basic init
    loadUserProfile();
    loadOrders();

    // Click outside modals to close
    window.addEventListener('click', function (e) {
        const returnModal = document.getElementById('returnModal');
        const ticketModal = document.getElementById('ticketModal');
        if (e.target === returnModal) closeReturnModal();
        if (e.target === ticketModal) closeTicketModal();
    });

    // Pre-fill tracker from URL param ?order=Ord-001
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam) {
        const inp = document.getElementById('trackOrderInput');
        if (inp) { inp.value = orderParam; trackOrder(); }
    }
});
