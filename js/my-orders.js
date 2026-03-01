/**
 * My Orders Page Logic for GenziKart.in
 * Handles fetching, filtering, and order actions
 */

var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize Page
    loadOrders();

    // Listen for search input
    const searchInp = document.querySelector('input[placeholder="Search orders..."]');
    if (searchInp) {
        searchInp.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            debouncedSearch(query);
        });
    }
});

let allOrders = [];
let currentFilter = 'all';

async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    const emptyState = document.getElementById('emptyState');

    // Show Loading
    container.innerHTML = `
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-6 animate-pulse">
            <div class="w-32 h-32 rounded-2xl bg-slate-100"></div>
            <div class="flex-1 space-y-4 py-1">
                <div class="h-4 bg-slate-100 rounded w-3/4"></div>
                <div class="space-y-2">
                    <div class="h-4 bg-slate-100 rounded"></div>
                    <div class="h-4 bg-slate-100 rounded w-5/6"></div>
                </div>
            </div>
        </div>
    `.repeat(3);

    try {
        const orders = await apiFetch('/orders');
        allOrders = Array.isArray(orders) ? orders : [];

        updateFilterCounts();
        renderOrders();

    } catch (err) {
        console.error('Failed to load orders:', err);
        container.innerHTML = `
            <div class="p-12 text-center text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p class="font-bold">Failed to load orders.</p>
                <button onclick="loadOrders()" class="mt-4 text-amber-600 font-bold hover:underline">Try Again</button>
            </div>
        `;
    }
}

function updateFilterCounts() {
    document.getElementById('count-all').textContent = `(${allOrders.length})`;
    document.getElementById('count-delivered').textContent = `(${allOrders.filter(o => o.status === 'delivered').length})`;
    document.getElementById('count-cancelled').textContent = `(${allOrders.filter(o => o.status === 'cancelled').length})`;
    document.getElementById('count-returned').textContent = `(${allOrders.filter(o => o.status === 'returned').length})`;
}

function filterOrders(filter) {
    currentFilter = filter;

    // Update active UI
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-amber-500', 'text-white', 'shadow-lg', 'shadow-amber-500/30');
        btn.classList.add('text-slate-600', 'hover:bg-slate-50');
    });

    const activeBtn = event.currentTarget;
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
    activeBtn.classList.add('active', 'bg-amber-500', 'text-white', 'shadow-lg', 'shadow-amber-500/30');

    renderOrders();
}

const debouncedSearch = debounce((query) => {
    const filtered = allOrders.filter(order =>
        order.id?.toLowerCase().includes(query) ||
        order.items.some(item => item.name.toLowerCase().includes(query))
    );
    renderOrders(filtered);
}, 300);

function renderOrders(ordersToRender = null) {
    const container = document.getElementById('ordersContainer');
    const emptyState = document.getElementById('emptyState');

    let orders = ordersToRender || allOrders;

    // Apply Tab Filter if not manual search
    if (!ordersToRender && currentFilter !== 'all') {
        orders = orders.filter(o => o.status === currentFilter);
    }

    // Sorting
    const sortBy = document.getElementById('sortOrders')?.value;
    if (sortBy === 'recent') {
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
        orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    if (orders.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = orders.map(order => createOrderCard(order)).join('');
}

function createOrderCard(order) {
    const statusConfig = {
        'pending': { color: 'text-slate-500', bg: 'bg-slate-100', icon: 'fa-clock', label: 'Processing' },
        'processing': { color: 'text-amber-600', bg: 'bg-amber-50', icon: 'fa-spinner fa-spin', label: 'Processing' },
        'shipped': { color: 'text-blue-600', bg: 'bg-blue-50', icon: 'fa-truck', label: 'Shipped' },
        'delivered': { color: 'text-green-600', bg: 'bg-green-50', icon: 'fa-check-circle', label: 'Delivered' },
        'cancelled': { color: 'text-red-600', bg: 'bg-red-50', icon: 'fa-times-circle', label: 'Cancelled' },
        'returned': { color: 'text-purple-600', bg: 'bg-purple-50', icon: 'fa-undo', label: 'Returned' }
    };

    const config = statusConfig[order.status] || statusConfig['pending'];
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // Buttons logic
    let actionButtons = '';
    if (order.status === 'processing' || order.status === 'pending') {
        actionButtons = `<button onclick="cancelOrder('${order._id}')" class="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm">Cancel Order</button>`;
    }

    if (order.status === 'shipped' || order.status === 'processing' || order.status === 'pending') {
        actionButtons += `<button onclick="trackOrder('${order._id}')" class="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-600 transition-all text-sm shadow-md shadow-amber-500/20">Track Order</button>`;
    }

    if (order.status === 'delivered') {
        actionButtons = `
            <button onclick="returnOrder('${order._id}')" class="bg-amber-100/50 text-amber-700 px-6 py-2.5 rounded-xl font-bold hover:bg-amber-100 transition-all text-sm">Return / Replace</button>
            <button onclick="rateProduct('${order._id}')" class="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm">Rate Product</button>
        `;
    }

    if (order.status === 'returned') {
        actionButtons = `<button onclick="refundStatus('${order._id}')" class="bg-purple-50 text-purple-600 px-6 py-2.5 rounded-xl font-bold hover:bg-purple-100 transition-all text-sm">Refund Status</button>`;
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
        actionButtons += `<button onclick="reorder('${order._id}')" class="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm">Reorder</button>`;
    }

    // Invoice Button (Always show if delivered)
    if (order.status === 'delivered') {
        actionButtons += `<button onclick="downloadInvoice('${order._id}')" class="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm flex items-center gap-2"><i class="fas fa-file-invoice"></i> Invoice</button>`;
    }

    // Digital Product Download
    const hasDigital = order.items.some(item => item.isDigital);
    if (hasDigital && order.paymentStatus === 'Paid') {
        actionButtons += `<button onclick="downloadDigital('${order._id}')" class="bg-green-100 text-green-600 px-6 py-2.5 rounded-xl font-bold hover:bg-green-200 transition-all text-sm flex items-center gap-2"><i class="fas fa-download"></i> Download Content</button>`;
    }


    // Use the first item's image if available, otherwise use a placeholder
    const firstItem = order.items[0] || { name: 'Genzi Product', price: order.total };
    const itemImg = firstItem.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstItem.name)}&background=f8fafc&color=64748b&bold=true&length=2`;

    // Dynamic Payment Label
    const paymentLabel = order.payment === 'cod' ? 'Cash on Delivery' :
        order.payment === 'cod_advance_pending' ? 'COD (Advance Pending)' :
            order.payment === 'paid' ? 'Paid Online' : 'Payment Pending';

    return `
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group animate-fade-in">
            <div class="flex flex-col md:flex-row gap-6">
                <div class="w-full md:w-32 h-32 rounded-2xl bg-slate-50 overflow-hidden flex-shrink-0">
                    <img src="${itemImg}" alt="${firstItem.name}" class="w-full h-full object-cover">
                </div>
                
                <div class="flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="text-xl font-bold text-slate-900 group-hover:text-amber-500 transition-colors">${firstItem.name}</h3>
                            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Order #${order.id}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-black text-slate-900">₹${order.total}</p>
                            <p class="text-xs font-bold text-slate-400">Placed on ${dateStr}</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 mt-4 py-3 border-y border-slate-50">
                        <div class="flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.color} text-xs font-black uppercase">
                            <i class="fas ${config.icon}"></i>
                            ${config.label}
                        </div>
                        <span class="text-xs font-bold text-slate-400"><i class="fas fa-credit-card mr-1"></i> ${paymentLabel}</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 mt-6">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Actions
async function cancelOrder(id) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
        await apiFetch(`/orders/${id}/cancel`, { method: 'POST' });
        showToast('Order cancelled successfully', 'success');
        loadOrders(); // Refresh
    } catch (err) {
        showError(err.message || 'Failed to cancel order');
    }
}

async function returnOrder(id) {
    // Navigate to support or show modal
    window.location.href = `support.html?action=return&orderId=${id}`;
}

function trackOrder(id) {
    window.location.href = `track-order.html?id=${id}`;
}

async function reorder(id) {
    const order = allOrders.find(o => o._id === id);
    if (!order) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    order.items.forEach(item => {
        // Add to cart logic (simplified)
        cart.push({ ...item, quantity: 1 });
    });

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showToast('Items added to cart!', 'success');
    window.location.href = 'cart.html';
}

function rateProduct(id) {
    showToast('Rating feature coming soon!', 'info');
}

function refundStatus(id) {
    window.location.href = `support.html?action=refund&orderId=${id}`;
}

function downloadInvoice(id) {
    showToast('Generating invoice...', 'info');
    // Using utils.js apiFetch or just open link
    window.open(`${API_BASE_URL}/orders/${id}/invoice`, '_blank');
}

function downloadDigital(id) {
    showToast('Preparing download...', 'success');
    // Mock download
    setTimeout(() => {
        window.location.href = `${API_BASE_URL}/orders/${id}/download`;
    }, 1000);
}

