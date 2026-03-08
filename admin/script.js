if (typeof isLocal === 'undefined') {
    var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
}
// Production backend URL
var API_BASE_URL = 'https://gen-z-backend.vercel.app/api';

const state = {
    currentPage: 'dashboard',
    products: [],
    orders: [],
    customers: [],
    reviews: [],
    discounts: [],
    offerVideos: [],
    notifications: [],
    pageNotifications: [], // Store notifications for the main table
    unreadCount: 0,
    stats: {
        sales: 0,
        salesChange: 0,
        orders: 0,
        ordersChange: 0,
        products: 0,
        productsChange: 0,
        customers: 0,
        customersChange: 0
    },
    pagination: {
        products: { currentPage: 1, limit: 10 },
        orders: { currentPage: 1, limit: 10 },
        customers: { currentPage: 1, limit: 10 },
        reviews: { currentPage: 1, limit: 10 },
        discounts: { currentPage: 1, limit: 10 },
        offers: { currentPage: 1, limit: 10 }
    }
};

/**
 * Centrialized Currency Formatter
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Image URL Formatter - Supports Google Drive thumbnails
 */
function formatImageUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // Handle Google Drive links
    if (url.includes('drive.google.com')) {
        const driveIdMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
            const fileId = driveIdMatch[1];
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    }
    return url;
}


// ==========================================
// 2. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Load initial data from backend (Check session first)
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    if (!token || role !== 'admin') {
        console.warn("🚫 Unauthorized access, redirecting to admin login...");
        window.location.href = 'login.html';
        return;
    }

    lucide.createIcons();
    updateAdminProfile();
    fetchAllData();

    // Load initial page
    navigate('dashboard');

    // Initialize charts
    initCharts();

    // Initialize Notifications
    initNotifications();
});

let socket;
let notificationPollingInterval;
const ORDER_NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

function initNotifications() {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');

    if (bell && dropdown) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // Initial Fetch
    fetchUnreadCount();
    fetchNotifications();

    // Initialize Socket with Fallback
    initAdminSocket();
}

function initAdminSocket() {
    // Load Socket.IO client script dynamically if not present
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
        script.onload = () => setupSocketConnection();
        script.onerror = () => startNotificationPolling();
        document.head.appendChild(script);
    } else {
        setupSocketConnection();
    }
}

function setupSocketConnection() {
    try {
        const backendUrl = API_BASE_URL.replace('/api', '');
        socket = io(backendUrl, {
            transports: ['websocket', 'polling'], // Allow polling fallback
            reconnectionAttempts: 3
        });

        socket.on('connect', () => {
            console.log('📡 Connected to Real-time Notification Server');
            if (notificationPollingInterval) {
                clearInterval(notificationPollingInterval);
                notificationPollingInterval = null;
            }
        });

        socket.on('connect_error', (error) => {
            console.warn('⚠️ Socket.IO connection failed, using polling fallback:', error.message);
            startNotificationPolling();
        });

        socket.on('newNotification', (notification) => {
            console.log('🔔 New Notification Received:', notification);
            state.notifications.unshift(notification);
            state.unreadCount++;
            updateNotificationUI();

            // Sound for new orders
            if (notification.type === 'order') {
                const audio = new Audio(ORDER_NOTIFICATION_SOUND);
                audio.play().catch(e => console.warn('Audio playback blocked by browser'));
            }

            showToast(`New ${notification.type}: ${notification.title}`);
        });
    } catch (err) {
        console.error('Socket setup error:', err);
        startNotificationPolling();
    }
}

function startNotificationPolling() {
    if (notificationPollingInterval) return;
    console.log('🔄 Starting notification polling fallback (60s)...');

    // Initial fetch for fallback
    fetchUnreadCount();

    notificationPollingInterval = setInterval(() => {
        console.log('📥 Polling for notifications...');
        fetchUnreadCount();
        // If the notifications dashboard is open, refresh it too
        if (state.currentPage === 'notifications' && typeof loadNotificationsTable === 'function') {
            loadNotificationsTable(currentNotificationPage);
        }
    }, 60000); // Poll every 60 seconds to avoid overloading server
}

/**
 * Dynamic Admin Profile Update
 */
function updateAdminProfile() {
    const name = localStorage.getItem('adminName') || 'System Admin';
    const role = localStorage.getItem('userRole') || 'Administrator';

    const nameEl = document.getElementById('admin-name');
    const roleEl = document.getElementById('admin-role');

    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Notification API Interactions & UI
 */
async function fetchNotifications() {
    try {
        const res = await apiFetch('/notifications?limit=10');
        state.notifications = res.notifications;
        updateNotificationUI();
    } catch (err) {
        console.error('Error fetching notifications:', err);
    }
}

async function fetchUnreadCount() {
    try {
        const res = await apiFetch('/notifications/unread-count');
        state.unreadCount = res.count;
        updateNotificationBadge();
    } catch (err) {
        console.error('Error fetching unread count:', err);
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const countText = document.getElementById('unread-count-text');

    if (badge) {
        if (state.unreadCount > 0) {
            badge.textContent = state.unreadCount > 9 ? '9+' : state.unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (countText) {
        countText.textContent = `You have ${state.unreadCount} unread messages`;
    }
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    dropdown.classList.toggle('opacity-0');
    dropdown.classList.toggle('scale-95');
    dropdown.classList.toggle('pointer-events-none');

    // If opening, refresh data
    if (!dropdown.classList.contains('opacity-0')) {
        fetchNotifications();
    }
}

function updateNotificationUI() {
    updateNotificationBadge();
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (state.notifications.length === 0) {
        list.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-20"></i>
                <p class="text-sm">No notifications yet</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = state.notifications.map(n => {
        const icon = getNotificationIcon(n.type);
        const colorClass = getNotificationColor(n.type);
        const timeAgo = formatTimeAgo(n.createdAt);

        return `
            <div class="p-4 hover:bg-gray-50 flex gap-4 cursor-pointer transition-colors ${n.isRead ? '' : 'bg-indigo-50/30'}" 
                 onclick="markAsRead('${n._id}', '${n.type}', '${n.referenceId}')">
                <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 text-white"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-0.5">
                        <p class="text-sm font-semibold text-gray-800 truncate">${n.title || 'System Notification'}</p>
                        <span class="text-[10px] text-gray-400 whitespace-nowrap">${timeAgo}</span>
                    </div>
                    <p class="text-xs text-gray-500 line-clamp-1 mb-1">${n.message || 'No details available.'}</p>
                    ${n.email || n.phone ? `
                        <div class="flex flex-wrap gap-2 mt-1">
                            ${n.email ? `<span class="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded flex items-center gap-1 leading-none"><i data-lucide="mail" class="w-2.5 h-2.5"></i> ${n.email}</span>` : ''}
                            ${n.phone ? `<span class="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded flex items-center gap-1 leading-none"><i data-lucide="phone" class="w-2.5 h-2.5"></i> ${n.phone}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function getNotificationIcon(type) {
    switch (type) {
        case 'order': return 'shopping-bag';
        case 'review': return 'star';
        case 'ticket': return 'life-buoy';
        case 'contact': return 'mail';
        default: return 'bell';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'order': return 'bg-emerald-500';
        case 'review': return 'bg-amber-500';
        case 'ticket': return 'bg-blue-500';
        case 'contact': return 'bg-purple-500';
        default: return 'bg-gray-500';
    }
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

async function openNotificationModal(n) {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    // Show immediately with loading state
    modalContent.innerHTML = `
        <div class="p-12 text-center text-gray-400">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p class="text-sm font-medium">Loading details...</p>
        </div>
    `;
    document.getElementById('generic-modal').classList.remove('hidden');

    // STEP 1: Immediately look up user from already-loaded customers state
    let emailToSearch = n.email;
    let userProfile = emailToSearch
        ? (state.customers || []).find(c => c.email === emailToSearch)
        : null;

    // STEP 2: Fetch original source document for full details
    try {
        if (n.type === 'contact' && n.referenceId) {
            const contact = await apiFetch(`/contact/${n.referenceId}`);
            if (contact) {
                n.name = n.name || contact.name;
                n.email = n.email || contact.email;
                n.phone = n.phone || contact.phone;
                n._contactMessage = contact.message;
                n._contactSubject = contact.subject;
                if (!emailToSearch) emailToSearch = contact.email;
            }
        } else if (n.type === 'ticket' && n.referenceId) {
            const ticket = await apiFetch(`/tickets/${n.referenceId}`);
            if (ticket) {
                // Store full ticket details for display
                n._ticketId = ticket.ticketId;
                n._ticketSubject = ticket.subject;
                n._ticketCategory = ticket.category;
                n._ticketPriority = ticket.priority;
                n._ticketMessage = ticket.message;  // ← the actual user-typed message
                n._ticketStatus = ticket.status;
                n._ticketReply = ticket.adminReply;
            }
        }
    } catch (err) {
        console.warn('Could not fetch reference document:', err);
    }

    // STEP 3: If userProfile not yet found, try fetching from /api/users
    if (!userProfile && emailToSearch) {
        userProfile = (state.customers || []).find(c => c.email === emailToSearch);
        if (!userProfile) {
            try {
                const allUsers = await apiFetch('/users');
                const list = Array.isArray(allUsers) ? allUsers : (allUsers && allUsers.users) || [];
                userProfile = list.find(u => u.email === emailToSearch);
            } catch (err) {
                console.warn('Could not fetch user profile:', err);
            }
        }
    }

    // STEP 4: Resolve best display values
    const displayName = (userProfile?.name) || n.name || (() => {
        if (n.type === 'contact' && n.message) {
            const m = n.message.match(/New message from ([^:]+):/i);
            return m ? m[1].trim() : null;
        }
        return null;
    })();
    const displayEmail = (userProfile?.email) || n.email || null;
    const displayPhone = (userProfile?.phone || userProfile?.whatsapp) || n.phone || null;

    // Priority badge color helper
    const priorityColor = {
        high: 'bg-red-100 text-red-700',
        medium: 'bg-yellow-100 text-yellow-700',
        low: 'bg-green-100 text-green-700'
    };

    // STEP 5: Render
    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
            <div>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getNotificationBadgeClass(n.type)} mb-1">
                    ${n.type || 'System'}
                </span>
                <h2 class="text-xl font-bold text-gray-900">${n.title || 'Notification Details'}</h2>
                <p class="text-xs text-gray-400 mt-1">${new Date(n.createdAt).toLocaleString()}</p>
            </div>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>

        <div class="space-y-4">

            <!-- Customer Profile Card -->
            ${(displayName || displayEmail || displayPhone) ? `
            <div class="bg-gradient-to-r from-primary/5 to-indigo-50 border border-primary/10 rounded-2xl p-5">
                <p class="text-[10px] text-primary font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                    <i data-lucide="user-circle" class="w-3 h-3"></i> Customer Profile
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    ${displayName ? `<div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Name</p>
                        <p class="text-sm font-bold text-gray-900 truncate">${displayName}</p>
                    </div>` : ''}
                    ${displayEmail ? `<div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Email</p>
                        <p class="text-sm font-bold text-primary break-all">${displayEmail}</p>
                    </div>` : ''}
                    ${displayPhone ? `<div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Phone</p>
                        <p class="text-sm font-bold text-gray-900">${displayPhone}</p>
                    </div>` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Ticket Detail Cards (only for ticket type) -->
            ${n.type === 'ticket' && n._ticketId ? `
            <div class="border border-gray-100 rounded-2xl p-5 bg-white">
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                    <i data-lucide="ticket" class="w-3 h-3"></i> Ticket Info
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Ticket ID</p>
                        <p class="text-xs font-bold text-gray-800">${n._ticketId}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Category</p>
                        <p class="text-xs font-bold text-gray-800">${n._ticketCategory || '—'}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Priority</p>
                        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-bold ${priorityColor[n._ticketPriority] || 'bg-gray-100 text-gray-600'}">
                            ${n._ticketPriority || 'Medium'}
                        </span>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">Status</p>
                        <p class="text-xs font-bold text-gray-800">${n._ticketStatus || 'Open'}</p>
                    </div>
                </div>
                ${n._ticketSubject ? `
                <div class="mb-3">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Subject</p>
                    <p class="text-sm font-semibold text-gray-900">${n._ticketSubject}</p>
                </div>` : ''}
                <div>
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">User's Message</p>
                    <p class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3">${n._ticketMessage || '—'}</p>
                </div>
                ${n._ticketReply ? `
                <div class="mt-3 border-t border-gray-100 pt-3">
                    <p class="text-[10px] text-green-600 uppercase font-bold mb-1 tracking-wider">Admin Reply</p>
                    <p class="text-sm text-gray-700 leading-relaxed">${n._ticketReply}</p>
                </div>` : ''}
            </div>
            ` : ''}

            <!-- Contact / Other Message Box -->
            ${n.type !== 'ticket' ? `
            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    ${n._contactSubject ? `Subject: ${n._contactSubject}` : 'Message'}
                </p>
                <p class="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
                    ${n._contactMessage || n.message || 'No details available.'}
                </p>
            </div>
            ` : ''}

        </div>
    `;

    lucide.createIcons();
}

async function markAsRead(id, type, refId) {
    try {
        await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });

        // Update local state
        let notif = state.notifications.find(n => n._id === id);
        if (!notif) {
            notif = state.pageNotifications.find(n => n._id === id);
        }

        if (notif && !notif.isRead) {
            notif.isRead = true;
            state.unreadCount = Math.max(0, state.unreadCount - 1);
            updateNotificationUI();

            // If on notifications page, refresh table
            if (state.currentPage === 'notifications') {
                loadNotificationsTable(currentNotificationPage);
            }
        }

        // Handle navigation and details
        if (type === 'order' && refId) {
            openOrderDetails(refId);
        } else if (notif) {
            // Show generic detail modal for other types
            openNotificationModal(notif);
        } else {
            // Fallback: If not in state, fetch single notif (for safety)
            try {
                const fetched = await apiFetch(`/notifications/${id}`);
                if (fetched) openNotificationModal(fetched);
            } catch (fail) {
                console.error("Failed to fetch notification details:", fail);
            }
        }

        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && !dropdown.classList.contains('opacity-0')) {
            toggleNotificationDropdown();
        }
    } catch (err) {
        console.error('Error marking read:', err);
    }
}

async function markAllAsRead() {
    try {
        await apiFetch('/notifications/read-all', { method: 'PATCH' });
        state.notifications.forEach(n => n.isRead = true);
        state.unreadCount = 0;
        updateNotificationUI();
    } catch (err) {
        console.error('Error marking all as read:', err);
    }
}

/**
 * Secure Logout
 */
function logoutAdmin() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// ==========================================
// API CALLS
// ==========================================

// Helper for authenticated fetch
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    // Redirect on unauthorized
    if (response.status === 401) {
        console.error("🔒 Session expired or unauthorized, redirecting...");
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return null;
    }

    return response;
}

/**
 * Helper for API requests that prepends the base URL and handles auth
 */
async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await authFetch(url, options);
    if (!response) return null;
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'API request failed');
    }
    return await response.json();
}

async function fetchAllData() {
    console.log('🔄 Fetching all dashboard data...');
    const fetchers = [
        { name: 'Products', fn: fetchProducts },
        { name: 'Orders', fn: fetchOrders },
        { name: 'Customers', fn: fetchCustomers },
        { name: 'Reviews', fn: fetchReviews },
        { name: 'Discounts', fn: fetchDiscounts },
        { name: 'Offer Videos', fn: fetchOfferVideos }
    ];

    const results = await Promise.allSettled(fetchers.map(f => f.fn()));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`❌ Failed to fetch ${fetchers[index].name}:`, result.reason);
        }
    });

    updateStats();
}

async function fetchProducts() {
    try {
        const response = await authFetch(`${API_BASE_URL}/products`);
        if (!response || !response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        // The backend returns { success: true, products: [...] }
        state.products = data.products || [];
        if (state.currentPage === 'products') renderProductsTable();
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

async function fetchOrders() {
    try {
        // Fetch all orders using the ?all=true flag which the controller supports
        const response = await authFetch(`${API_BASE_URL}/orders?all=true`);
        if (!response || !response.ok) throw new Error('Failed to fetch orders');
        state.orders = await response.json();
        if (state.currentPage === 'orders') renderOrdersTable();
    } catch (error) {
        console.error('Error fetching orders:', error);
    }
}

async function fetchCustomers() {
    try {
        const response = await authFetch(`${API_BASE_URL}/customers`);
        if (!response || !response.ok) throw new Error('Failed to fetch customers');
        state.customers = await response.json();
        if (state.currentPage === 'customers') renderCustomers(document.getElementById('main-content'));
    } catch (error) {
        console.error('Error fetching customers:', error);
    }
}

async function fetchReviews() {
    try {
        const response = await authFetch(`${API_BASE_URL}/reviews/admin`);
        if (!response.ok) throw new Error('Failed to fetch reviews');
        state.reviews = await response.json();
        if (state.currentPage === 'reviews') renderReviews(document.getElementById('main-content'));
    } catch (error) {
        console.error('Error fetching reviews:', error);
    }
}

async function fetchDiscounts() {
    try {
        const response = await authFetch(`${API_BASE_URL}/discounts`);
        if (!response.ok) throw new Error('Failed to fetch discounts');
        state.discounts = await response.json();
        if (state.currentPage === 'discounts') renderDiscounts(document.getElementById('main-content'));
    } catch (error) {
        console.error('Error fetching discounts:', error);
    }
}

function updateStats() {
    state.stats.products = state.products.length;
    state.stats.orders = state.orders.length;
    state.stats.customers = state.customers.length;
    state.stats.sales = state.orders.reduce((acc, order) => acc + (order.totalAmount || order.total || 0), 0);

    // Refresh charts with real data
    initCharts();

    // Refresh dashboard if active
    if (state.currentPage === 'dashboard') {
        renderDashboard(document.getElementById('main-content'));
    }
}

// ==========================================
// 3. NAVIGATION & ROUTING
// ==========================================

function navigate(page) {
    state.currentPage = page;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-indigo-50', 'text-primary');
        item.classList.add('text-gray-600', 'hover:bg-gray-50', 'hover:text-gray-900');
    });

    const activeNav = document.getElementById(`nav-${page}`);
    if (activeNav) {
        activeNav.classList.add('bg-indigo-50', 'text-primary');
        activeNav.classList.remove('text-gray-600', 'hover:bg-gray-50', 'hover:text-gray-900');
    }

    // Close mobile sidebar
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }

    // Render page content
    renderPage(page);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.classList.add('sidebar-open');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.classList.remove('sidebar-open');
    }
}

function renderPage(page) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    switch (page) {
        case 'dashboard':
            renderDashboard(mainContent);
            break;
        case 'products':
            renderProducts(mainContent);
            break;
        case 'orders':
            renderOrders(mainContent);
            break;
        case 'customers':
            renderCustomers(mainContent);
            break;
        case 'reviews':
            renderReviews(mainContent);
            break;
        case 'discounts':
            renderDiscounts(mainContent);
            break;
        case 'settings':
            renderSettings(mainContent);
            break;
        case 'offers':
            renderOffers(mainContent);
            break;
        case 'notifications':
            renderNotificationsPage();
            break;
        default:
            renderDashboard(mainContent);
    }

    // Re-initialize icons for new content
    lucide.createIcons();
}

// ==========================================
// 4. DASHBOARD PAGE
// ==========================================

function renderDashboard(container) {
    container.innerHTML = `
        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
            <p class="text-gray-500 mt-1">Welcome back! Here's what's happening with your store.</p>
        </div>
        
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            ${renderStatCard('Total Sales', formatCurrency(state.stats.sales), state.stats.salesChange, 'dollar-sign', 'text-green-600', 'bg-green-100')}
            ${renderStatCard('Total Orders', state.stats.orders, state.stats.ordersChange, 'shopping-cart', 'text-blue-600', 'bg-blue-100')}
            ${renderStatCard('Total Products', state.stats.products, state.stats.productsChange, 'package', 'text-purple-600', 'bg-purple-100')}
            ${renderStatCard('Total Customers', state.stats.customers, state.stats.customersChange, 'users', 'text-orange-600', 'bg-orange-100')}
        </div>
        
        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
                <div class="h-[300px] relative">
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Sales by Category</h3>
                <div class="h-[300px] relative">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Recent Orders & Reviews -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Recent Orders</h3>
                    <a href="#" onclick="navigate('orders')" class="text-sm text-primary hover:underline">View All</a>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th class="pb-3">Order ID</th>
                                <th class="pb-3">Customer</th>
                                <th class="pb-3">Status</th>
                                <th class="pb-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${state.orders.slice(0, 5).map(order => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="py-3 text-sm font-medium text-gray-900">${order.id}</td>
                                    <td class="py-3 text-sm text-gray-600">${order.customer}</td>
                                    <td class="py-3">${renderStatusBadge(order.status)}</td>
                                    <td class="py-3 text-sm text-gray-900 text-right font-medium">${formatCurrency(order.totalAmount || order.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Recent Reviews</h3>
                    <a href="#" onclick="navigate('reviews')" class="text-sm text-primary hover:underline">View All</a>
                </div>
                <div class="space-y-4">
                    ${state.reviews.slice(0, 4).map(review => `
                        <div class="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                                ${(review.name || 'C').charAt(0)}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <p class="text-sm font-medium text-gray-900">${review.name || 'Anonymous'}</p>
                                    <span class="text-xs text-gray-500">${review.date}</span>
                                </div>
                                <p class="text-sm text-gray-600 truncate">${review.comment}</p>
                                <div class="flex items-center gap-1 mt-1">
                                    ${renderStars(review.rating)}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Initialize charts after DOM update
    setTimeout(() => {
        initCharts();
    }, 100);
}

function renderStatCard(title, value, change, icon, iconBg, iconColor) {
    const isPositive = change >= 0;
    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-500">${title}</p>
                    <p class="text-2xl font-bold text-gray-900 mt-1">${typeof value === 'number' ? value.toLocaleString() : value}</p>
                </div>
                <div class="w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center">
                    <i data-lucide="${icon}" class="w-6 h-6 ${iconColor.replace('text-', '')}"></i>
                </div>
            </div>
            <div class="flex items-center mt-4">
                <span class="text-sm ${isPositive ? 'text-green-600' : 'text-red-600'} font-medium flex items-center">
                    <i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}" class="w-4 h-4 mr-1"></i>
                    ${Math.abs(change)}%
                </span>
                <span class="text-sm text-gray-500 ml-2">vs last month</span>
            </div>
        </div>
    `;
}

function renderStatusBadge(status) {
    const styles = {
        'pending': 'bg-yellow-100 text-yellow-700',
        'placed': 'bg-slate-100 text-slate-700',
        'confirmed': 'bg-amber-100 text-amber-700',
        'packed': 'bg-indigo-100 text-indigo-700',
        'processing': 'bg-blue-100 text-blue-700',
        'shipped': 'bg-blue-100 text-blue-700',
        'delivered': 'bg-green-100 text-green-700',
        'cancelled': 'bg-red-100 text-red-700',
        'active': 'bg-green-100 text-green-700',
        'out_of_stock': 'bg-red-100 text-red-700',
        'inactive': 'bg-gray-100 text-gray-700',
        'paid': 'bg-green-100 text-green-700',
        'refunded': 'bg-orange-100 text-orange-700',
        'approved': 'bg-green-100 text-green-700',
        'returned': 'bg-orange-100 text-orange-700'
    };

    const cleanStatus = (status || '').toLowerCase().replace(' (testing)', '');
    const style = styles[cleanStatus] || 'bg-gray-100 text-gray-700';
    const label = (status || 'Pending').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}">${label}</span>`;
}

function renderStars(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(`<i data-lucide="star" class="w-3.5 h-3.5 ${i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}"></i>`);
    }
    return `<div class="flex gap-0.5">${stars.join('')}</div>`;
}

/**
 * Generic Pagination Renderer
 */
function renderPagination(total, page, limit, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit + 1;
    const end = Math.min(total, page * limit);

    if (total === 0) return '';

    return `
        <div class="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p class="text-sm text-gray-500">
                Showing <span class="font-medium text-gray-900">${start}</span> to <span class="font-medium text-gray-900">${end}</span> of <span class="font-medium text-gray-900">${total}</span> results
            </p>
            <div class="flex items-center gap-2">
                <button onclick="${onPageChange}(${page - 1})" 
                        ${page <= 1 ? 'disabled' : ''} 
                        class="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i> Previous
                </button>
                <div class="flex items-center gap-1">
                    ${totalPages <= 5 ?
            Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                            <button onclick="${onPageChange}(${p})" 
                                    class="w-10 h-10 rounded-xl text-sm font-medium transition-all ${p === page ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">
                                ${p}
                            </button>
                        `).join('')
            :
            `<span class="px-3 py-2 text-sm font-bold text-primary bg-indigo-50 rounded-lg">Page ${page} of ${totalPages}</span>`
        }
                </div>
                <button onclick="${onPageChange}(${page + 1})" 
                        ${page >= totalPages ? 'disabled' : ''} 
                        class="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    Next <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// 5. PRODUCTS PAGE
// ==========================================

function renderProducts(container) {
    const total = state.products.length;
    const { currentPage, limit } = state.pagination.products;

    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Products</h1>
                <p class="text-gray-500 mt-1">Manage your product inventory</p>
            </div>
            <button onclick="openProductModal()" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-primary/20">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                Add New Product
            </button>
        </div>
        
        <!-- Filters & Search -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                        <input type="text" id="product-search" placeholder="Search products..." 
                                class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                    </div>
                </div>
                <div class="flex gap-2">
                    <select id="stock-filter" class="px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none bg-white font-medium text-gray-700">
                        <option value="all">All Stock</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Products Table -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50/50">
                        <tr class="border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Product</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">SKU</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Price</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Stock</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th class="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body" class="divide-y divide-gray-50">
                        <!-- Dynamic Content -->
                    </tbody>
                </table>
            </div>
            
            <div id="products-pagination-container">
                <!-- Pagination injected here -->
            </div>
        </div>
    `;

    renderProductsTable();

    // Add event listeners
    document.getElementById('product-search').addEventListener('input', () => {
        state.pagination.products.currentPage = 1; // Reset to page 1 on search
        filterProducts();
    });
    document.getElementById('stock-filter').addEventListener('change', () => {
        state.pagination.products.currentPage = 1;
        filterProducts();
    });
}

function renderProductsTable(filteredProducts = null) {
    const products = filteredProducts || state.products;
    const { currentPage, limit } = state.pagination.products;
    const tbody = document.getElementById('products-table-body');
    const paginationContainer = document.getElementById('products-pagination-container');

    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <i data-lucide="package" class="w-12 h-12 text-gray-200 mb-4"></i>
                        <p class="text-gray-500 font-medium">No products found</p>
                    </div>
                </td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        lucide.createIcons();
        return;
    }

    // Apply local pagination
    const start = (currentPage - 1) * limit;
    const end = start + limit;
    const paginatedProducts = products.slice(start, end);

    tbody.innerHTML = paginatedProducts.map(product => `
        <tr class="hover:bg-gray-50/50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl border border-gray-100 flex-shrink-0 bg-gray-50 overflow-hidden group-hover:border-primary/20 transition-all">
                        <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover">
                    </div>
                    <span class="font-semibold text-gray-900 group-hover:text-primary transition-colors">${product.name}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 font-mono">${product.sku || 'N/A'}</td>
            <td class="px-6 py-4 text-sm font-bold text-gray-900">${formatCurrency(product.price)}</td>
            <td class="px-6 py-4">
                <span class="text-sm font-medium ${product.stock <= 5 ? 'text-red-500' : 'text-gray-600'}">
                    ${product.stock} units
                </span>
            </td>
            <td class="px-6 py-4">${renderStatusBadge(product.status)}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="editProduct('${product._id || product.id}')" class="p-2 text-gray-400 hover:text-primary hover:bg-indigo-50 rounded-xl transition-all" title="Edit">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteProduct('${product._id || product.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (paginationContainer) {
        paginationContainer.innerHTML = renderPagination(products.length, currentPage, limit, 'changeAdminPage.products');
    }

    lucide.createIcons();
}

/**
 * Page Change Coordinator
 */
const changeAdminPage = {
    products: (page) => {
        state.pagination.products.currentPage = page;
        filterProducts(); // Re-filter to apply pagination to the filtered list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    orders: (page) => {
        state.pagination.orders.currentPage = page;
        filterOrders(); // Re-filter to apply pagination to the filtered list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    customers: (page) => {
        state.pagination.customers.currentPage = page;
        renderCustomersGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    reviews: (page) => {
        state.pagination.reviews.currentPage = page;
        renderReviewsTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

function filterProducts() {
    const search = document.getElementById('product-search').value.toLowerCase();
    const stockFilter = document.getElementById('stock-filter').value;

    const filtered = state.products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search);
        const matchesStock = stockFilter === 'all' ||
            (stockFilter === 'in_stock' && product.stock > 0) ||
            (stockFilter === 'out_of_stock' && product.stock === 0);
        return matchesSearch && matchesStock;
    });

    renderProductsTable(filtered);
}

function openProductModal(product = null) {
    const isEdit = product !== null;
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900">${isEdit ? 'Edit Product' : 'Add New Product'}</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>
        
        <form id="product-form" onsubmit="saveProduct(event, ${product ? `'${product._id || product.id}'` : 'null'})">
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                        <input type="text" name="name" value="${product ? product.name : ''}" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select name="category" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white">
                            <option value="iPhone" ${product && product.category === 'iPhone' ? 'selected' : ''}>iPhone</option>
                            <option value="Samsung" ${product && product.category === 'Samsung' ? 'selected' : ''}>Samsung</option>
                            <option value="Buds" ${product && product.category === 'Buds' ? 'selected' : ''}>Buds</option>
                            <option value="Templates" ${product && product.category === 'Templates' ? 'selected' : ''}>Templates</option>
                            <option value="Others" ${product && product.category === 'Others' ? 'selected' : ''}>Others</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                        <input type="text" name="sku" value="${product ? product.sku || '' : ''}" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Price (INR)</label>
                        <input type="number" name="price" value="${product ? product.price : ''}" step="0.01" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                        <input type="number" name="stock" value="${product ? product.stock : ''}" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select name="status" class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                            <option value="In Stock" ${product && product.status === 'In Stock' ? 'selected' : ''}>In Stock</option>
                            <option value="Out of Stock" ${product && (product.status === 'Out of Stock' || product.status === 'out_of_stock') ? 'selected' : ''}>Out of Stock</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input type="url" name="image" value="${product ? product.image : ''}" placeholder="https://..."
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Gallery Images (Comma separated URLs)</label>
                    <textarea name="gallery" placeholder="https://image1.jpg, https://image2.jpg"
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none">${product && product.gallery ? product.gallery.join(', ') : ''}</textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
                    <textarea name="description" rows="3" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none">${product ? product.description || '' : ''}</textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Product Highlights (One per line)</label>
                    <textarea name="highlights" rows="3" placeholder="Aged 2 years&#10;7 Days Replacement"
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none">${product && product.highlights ? product.highlights.join('\n') : ''}</textarea>
                </div>

                <div class="flex items-center gap-2">
                    <input type="checkbox" name="bestseller" id="bestseller-check" ${product && product.bestseller ? 'checked' : ''}
                        class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
                    <label for="bestseller-check" class="text-sm font-medium text-gray-700">Mark as Best Seller</label>
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">${isEdit ? 'Update' : 'Create'}</button>
            </div>
        </form>
    `;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

function editProduct(id) {
    const product = state.products.find(p => (p._id || p.id) == id);
    if (product) {
        openProductModal(product);
    }
}

async function saveProduct(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');

    const productData = {
        name: formData.get('name'),
        sku: formData.get('sku'),
        price: parseFloat(formData.get('price')),
        stock: parseInt(formData.get('stock')),
        status: formData.get('status'),
        image: formatImageUrl(formData.get('image')) || '',
        category: formData.get('category') || 'General',
        bestseller: form.querySelector('[name="bestseller"]').checked,
        description: formData.get('description'),
        gallery: formData.get('gallery') ? formData.get('gallery').split(/[,\n]/).map(s => formatImageUrl(s.trim())).filter(s => s !== '' && s.startsWith('http')) : [],
        highlights: formData.get('highlights') ? formData.get('highlights').split('\n').map(s => s.trim()).filter(s => s !== '') : []
    };

    // Simple validation
    if (isNaN(productData.price) || productData.price < 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">◌</span> Saving...';

        let response;
        if (id && id !== 'null') {
            // Update existing product
            response = await authFetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
        } else {
            // Add new product
            response = await authFetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to save product');
        }

        showToast(`Product ${id && id !== 'null' ? 'updated' : 'created'} successfully!`, 'success');

        // Refresh state and UI
        await fetchProducts();
        closeModal();
    } catch (error) {
        console.error('Error saving product:', error);
        showToast(`${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = id && id !== 'null' ? 'Update' : 'Create';
    }
}

async function deleteProduct(id) {
    const product = state.products.find(p => p._id === id || p.id === id); // Handle both formats
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
        try {
            const response = await authFetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete product');

            showToast('Product deleted successfully!', 'success');
            await fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Error deleting product', 'error');
        }
    }
}

// ==========================================
// 6. ORDERS PAGE
// ==========================================

function renderOrders(container) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Orders</h1>
                <p class="text-gray-500 mt-1">Manage customer orders</p>
            </div>
            <div class="flex gap-2">
                <button onclick="showStatusProductDetails('delivered')" class="inline-flex items-center px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-all text-sm font-bold">
                    <i data-lucide="package-check" class="w-4 h-4 mr-2"></i>
                    Delivered Details
                </button>
                <button onclick="showStatusProductDetails('returned')" class="inline-flex items-center px-4 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 transition-all text-sm font-bold">
                    <i data-lucide="rotate-ccw" class="w-4 h-4 mr-2"></i>
                    Return Details
                </button>
            </div>
        </div>
        
        <!-- Filters -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
            <div class="flex flex-wrap gap-4">
                <div class="flex-1 min-w-[200px]">
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                        <input type="text" id="order-search" placeholder="Search orders..." 
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                    </div>
                </div>
                <select id="status-filter" class="px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none bg-white font-medium text-gray-700">
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="returned">Returned</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>
        </div>
        
        <!-- Orders Table -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50/50">
                        <tr class="border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Order ID</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Total</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Payment</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th class="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body" class="divide-y divide-gray-50">
                        <!-- Dynamic Content -->
                    </tbody>
                </table>
            </div>
            <div id="orders-pagination-container"></div>
        </div>
    `;

    renderOrdersTable();
    document.getElementById('order-search').addEventListener('input', () => {
        state.pagination.orders.currentPage = 1;
        filterOrders();
    });
    document.getElementById('status-filter').addEventListener('change', () => {
        state.pagination.orders.currentPage = 1;
        filterOrders();
    });
}

function renderOrdersTable(filteredOrders = null) {
    const orders = filteredOrders || state.orders;
    const { currentPage, limit } = state.pagination.orders;
    const tbody = document.getElementById('orders-table-body');
    const paginationContainer = document.getElementById('orders-pagination-container');

    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <i data-lucide="shopping-cart" class="w-12 h-12 text-gray-200 mb-4"></i>
                        <p class="text-gray-500 font-medium">No orders found</p>
                    </div>
                </td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        lucide.createIcons();
        return;
    }

    const start = (currentPage - 1) * limit;
    const end = start + limit;
    const paginatedOrders = orders.slice(start, end);

    tbody.innerHTML = paginatedOrders.map(order => `
        <tr class="hover:bg-gray-50/50 transition-colors">
            <td class="px-6 py-4 text-sm font-bold text-primary">#${order.orderDisplayId || order.id}</td>
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <p class="text-sm font-bold text-gray-900">${order.customer || 'Guest'}</p>
                    <p class="text-xs text-gray-500">${order.email || 'No email'}</p>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 font-medium">${order.date}</td>
            <td class="px-6 py-4 text-sm font-bold text-gray-900">${formatCurrency(order.totalAmount || order.total)}</td>
            <td class="px-6 py-4">${renderStatusBadge(order.payment)}</td>
            <td class="px-6 py-4">${renderStatusBadge(order.status)}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="openOrderDetails('${order._id || order.id}')" 
                        class="px-4 py-2 bg-indigo-50 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all">
                    View Info
                </button>
            </td>
        </tr>
    `).join('');

    if (paginationContainer) {
        paginationContainer.innerHTML = renderPagination(orders.length, currentPage, limit, 'changeAdminPage.orders');
    }

    lucide.createIcons();
}

function filterOrders() {
    const search = document.getElementById('order-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;

    const filtered = state.orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(search) ||
            order.customer.toLowerCase().includes(search) ||
            order.email.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    renderOrdersTable(filtered);
}

async function openOrderDetails(id) {
    const order = state.orders.find(o => o._id === id);
    if (!order) return;

    const modalContent = document.getElementById('modal-content');
    const currentStatus = (order.orderStatus || order.status || 'Pending').toUpperCase();

    // Helper for History Formatting
    const formatHistoryTime = (dateStr) => {
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        return `${datePart}; ${timePart}`;
    };

    modalContent.innerHTML = `
    <!-- Header -->
    <div class="flex items-start justify-between mb-8">
        <div>
            <h2 class="text-3xl font-bold text-[#1e1b4b] tracking-tight">Order Details</h2>
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                <span class="text-[11px] font-black uppercase text-indigo-600 tracking-widest">${currentStatus}</span>
            </div>
        </div>
        <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-xl transition-all group">
            <i data-lucide="x" class="w-6 h-6 text-slate-400 group-hover:text-slate-600"></i>
        </button>
    </div>
    
    <div class="space-y-6 max-h-[72vh] overflow-y-auto pr-3 custom-scrollbar">
        <!-- Top Info Grid: Customer & Order -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Customer Information -->
            <div class="p-6 bg-[#f8fafc] rounded-2xl border border-slate-100">
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Customer Information</p>
                <h3 class="text-lg font-bold text-slate-900">${order.customer}</h3>
                <p class="text-sm text-slate-500 mt-1">${order.email}</p>
                <p class="text-sm text-slate-700 font-medium mt-1">${order.shippingAddress?.phone || order.phone || '9122278072'}</p>
            </div>

            <!-- Order Information -->
            <div class="p-6 bg-[#f8fafc] rounded-2xl border border-slate-100">
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Order Information</p>
                <div class="space-y-2">
                    <p class="text-lg font-bold text-indigo-600">${order.id}</p>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Order Date:</span>
                        <span class="font-bold text-slate-800">${new Date(order.createdAt || order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Payment Method:</span>
                        <span class="px-2 py-0.5 bg-amber-100/50 text-amber-700 text-[10px] font-black italic rounded border border-amber-200/50">Cash on Delivery</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Payment Status:</span>
                        <span class="font-bold text-slate-800">${order.paymentStatus || 'Pending'}</span>
                    </div>
                    ${order.paymentMethod === 'COD' ? `
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500 font-medium">COD Amount:</span>
                        <span class="font-bold text-slate-900">₹${order.codAmount || order.totalAmount || order.total}</span>
                    </div>` : ''}
                </div>
            </div>
        </div>

        <!-- Addresses Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 border border-slate-100 rounded-2xl">
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-3">Shipping Address</p>
                <p class="text-sm text-slate-600 leading-relaxed font-medium">
                    ${order.shippingAddress?.line1 || 'apna ghar'}<br>
                    ${order.shippingAddress?.line2 || ''}<br>
                    ${order.shippingAddress?.city || 'Sitamarhi'}, ${order.shippingAddress?.state || 'Bihar'} - <span class="font-bold text-slate-900">${order.shippingAddress?.pincode || '843302'}</span><br>
                    <span class="text-slate-400 mt-1 block">+91 ${order.shippingAddress?.phone || '9122278072'}</span>
                </p>
            </div>
            <div class="p-5 border border-slate-100 rounded-2xl">
                <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-3">Billing Address</p>
                <p class="text-sm text-slate-600 leading-relaxed font-medium">
                    ${order.billingAddress?.line1 || order.shippingAddress?.line1 || 'apna ghar'}<br>
                    ${order.billingAddress?.line2 || order.shippingAddress?.line2 || ''}<br>
                    ${order.billingAddress?.city || order.shippingAddress?.city || 'Sitamarhi'}, ${order.billingAddress?.state || order.shippingAddress?.state || 'Bihar'} - <span class="font-bold text-slate-900">${order.billingAddress?.pincode || order.shippingAddress?.pincode || '843302'}</span><br>
                    <span class="text-slate-400 mt-1 block">+91 ${order.billingAddress?.phone || order.shippingAddress?.phone || '9122278072'}</span>
                </p>
            </div>
        </div>

        <!-- Bottom Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-4">
                <div class="p-6 bg-white border border-slate-100 rounded-2xl">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Financial Breakdown</p>
                    <div class="space-y-3">
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">Subtotal</span>
                            <span class="font-bold text-slate-900">₹${order.subtotal || order.totalAmount || order.total}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">Shipping Charge</span>
                            <span class="font-bold text-slate-900">₹${order.shippingCharge || 0}</span>
                        </div>
                        <div class="flex justify-between text-xl pt-4 border-t border-slate-50">
                            <span class="font-bold text-slate-900">Grand Total</span>
                            <span class="font-black text-indigo-600">₹${order.totalAmount || order.total}</span>
                        </div>
                        <div class="flex justify-between text-sm mt-3 pt-3">
                            <span class="text-slate-800 font-bold">Amount to Collect:</span>
                            <span class="font-bold text-slate-900">₹${order.codAmount || order.totalAmount || order.total}</span>
                        </div>
                    </div>
                </div>

                <div class="p-6 bg-white border border-slate-100 rounded-2xl">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Admin Note</p>
                    <textarea id="admin-note-input" onblur="saveAdminNote('${order._id}', this.value)" class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none h-20" placeholder="Enter a note...">${order.adminNote || ''}</textarea>
                </div>
            </div>

            <div class="space-y-4">
                <div class="p-6 bg-white border border-slate-100 rounded-2xl">
                    <div class="flex justify-between items-center mb-4">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Invoice</p>
                        <p class="text-[11px] font-bold ${order.invoiceId ? 'text-indigo-600' : 'text-slate-400'}">${order.invoiceId?.invoiceNumber || 'Not Generated'}</p>
                    </div>
                    <div class="flex justify-between items-center text-sm mb-4">
                        <span class="text-slate-500">Invoice Date:</span>
                        <span class="font-bold text-slate-800">${order.invoiceId ? new Date(order.invoiceId.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '---'}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button 
                            onclick="${order.invoiceId ? `window.open('${API_BASE_URL}/invoices/${order.invoiceId._id}/download?token=${localStorage.getItem('token')}', '_blank')` : "showToast('Invoice not generated yet', 'info')"}" 
                            class="py-2.5 ${order.invoiceId ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-slate-200 cursor-not-allowed'} text-white text-[11px] font-bold rounded-xl transition-all">
                            Download Invoice
                        </button>
                        <button 
                            onclick="${order.invoiceId ? `resendInvoiceEmail('${order.invoiceId._id}')` : "showToast('Invoice not generated yet', 'info')"}" 
                            class="py-2.5 ${order.invoiceId ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-50 text-slate-400 cursor-not-allowed'} text-[11px] font-bold rounded-xl transition-all">
                            Resend Invoice
                        </button>
                    </div>
                </div>

                <div class="p-6 bg-white border border-slate-100 rounded-2xl">
                    <div class="flex justify-between items-center mb-4">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Shipping & Tracking</p>
                        <button onclick="window.open('${API_BASE_URL}/shipping/${order.id}/label?token=${localStorage.getItem('token')}', '_blank')" class="px-3 py-1 bg-white border border-slate-100 text-[9px] text-indigo-600 font-black uppercase rounded-lg hover:bg-indigo-50 transition-all shadow-sm">Print Shipping Label</button>
                    </div>
                    <div class="space-y-1">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Courier:</span>
                            <span class="text-lg font-bold text-slate-800">${order.courierName || 'Genzi Logistics'}</span>
                        </div>
                        <p class="text-xs text-slate-600 font-medium mt-1">Tracking ID: <span class="font-bold text-slate-900">${order.trackingId || '1112dxdfvgbgh'}</span> • <span class="text-[10px] text-slate-400">${order.estimatedDeliveryDate || '1 Mar — 3 Mar'}</span></p>
                        <p class="text-[10px] text-slate-400">Est. Delivery: <span class="font-bold text-slate-700">${order.estimatedDeliveryDate || '1 Mar — 3 Mar'}</span></p>
                    </div>
                </div>

                <div class="p-6 bg-white border border-slate-100 rounded-2xl">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Status History</p>
                    <div class="space-y-4">
                        ${(order.statusHistory || []).slice().reverse().map((t, idx) => `
                            <div class="flex gap-4 relative">
                                <div class="flex flex-col items-center">
                                    <div class="w-3 h-3 rounded-full ${idx === 0 ? 'bg-indigo-500 ring-4 ring-indigo-50' : 'bg-slate-200'}"></div>
                                    ${idx !== (order.statusHistory.length - 1) ? '<div class="w-0.5 h-full bg-slate-50 absolute top-3"></div>' : ''}
                                </div>
                                <div class="flex-1 -mt-0.5">
                                    <p class="text-xs font-black text-slate-900 uppercase tracking-tight">${t.status} <span class="text-[9px] font-normal text-slate-500 ml-1">Updated to ${t.status.toLowerCase()}</span></p>
                                    <p class="text-[10px] text-slate-400 mt-0.5 font-medium">${formatHistoryTime(t.updatedAt)} • Admin</p>
                                </div>
                                ${idx === 1 ? `<div class="w-2.5 h-2.5 rounded-full bg-slate-200/50 absolute -left-[1px] top-12"></div>` : ''}
                            </div>
                        `).join('') || `
                            <div class="flex gap-4">
                                <div class="w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-50"></div>
                                <div class="flex-1 -mt-0.5">
                                    <p class="text-xs font-black text-slate-900 uppercase tracking-tight">PENDING <span class="text-[9px] font-normal text-slate-500 ml-1">Updated to pending</span></p>
                                    <p class="text-[10px] text-slate-400 mt-0.5 font-medium">3 Mar 2026; 4.44 am • Admin</p>
                                </div>
                            </div>
                            <div class="flex gap-4 mt-4">
                                <div class="w-3 h-3 rounded-full bg-slate-200"></div>
                                <div class="flex-1 -mt-0.5">
                                    <p class="text-xs font-black text-slate-900 uppercase tracking-tight">PLACED <span class="text-[9px] font-normal text-slate-500 ml-1">Order placed successfully</span></p>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="flex gap-4 mt-8 pt-6 border-t border-slate-100">
        <button onclick="closeModal()" class="px-8 py-3.5 bg-[#f1f5f9] text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-[11px] tracking-widest">Close</button>
        <button onclick="cancelOrderAction('${order.id}')" class="px-8 py-3.5 border-2 border-red-50 text-red-500 font-black rounded-2xl hover:bg-red-50 transition-all uppercase text-[11px] tracking-widest">Canca. Order</button>
        <button onclick="showStatusUpdateForm('${order.id}')" class="flex-1 px-8 py-3.5 bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-600 hover:-translate-y-0.5 transition-all uppercase text-[11px] tracking-widest text-center">Update Order Status</button>
    </div>
    `;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

async function saveAdminNote(id, note) {
    try {
        await authFetch(`${API_BASE_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminNote: note })
        });
        showToast('System: Admin note synchronized successfully', 'success');
        const order = state.orders.find(o => o._id === id);
        if (order) order.adminNote = note;
    } catch (err) {
        showToast('Error: Failed to sync note', 'error');
    }
}

async function cancelOrderAction(id) {
    if (!confirm('DANGER: This will permanently cancel the order. Proceed?')) return;
    try {
        const response = await authFetch(`${API_BASE_URL}/shipping/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderStatus: 'Cancelled', message: 'Order has been cancelled by Admin.' })
        });
        if (!response.ok) throw new Error('Cancellation refusal from system');
        showToast('SUCCESS: Order status set to CANCELLED', 'success');
        await fetchOrders();
        closeModal();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showStatusUpdateForm(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    const modalContent = document.getElementById('modal-content');

    const currentStatus = order.orderStatus || order.status;

    modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-8">
        <div>
            <h2 class="text-xl font-bold text-slate-900">Update Shipping Status</h2>
            <p class="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Order #${order.id}</p>
        </div>
        <button onclick="openOrderDetails('${order._id}')" class="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <i data-lucide="arrow-left" class="w-5 h-5 text-slate-400 group-hover:text-indigo-500"></i>
        </button>
    </div>

    <form onsubmit="handleStatusUpdate(event, '${order.id}')" class="space-y-6">
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Status</label>
            <select name="status" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700">
                <option value="Placed" ${currentStatus === 'Placed' ? 'selected' : ''}>Placed</option>
                <option value="Confirmed" ${currentStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="Packed" ${currentStatus === 'Packed' ? 'selected' : ''}>Packed</option>
                <option value="Shipped" ${currentStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                <option value="Cancelled" ${currentStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Courier Partner</label>
                <input type="text" name="courierName" value="${order.courierName || 'Genzi Logistics'}" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700">
            </div>
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tracking Number</label>
                <input type="text" name="trackingId" value="${order.trackingId || ''}" placeholder="GZ-XXXX-XXXX" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700">
            </div>
        </div>

        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Status Message / Note</label>
            <textarea name="message" placeholder="Optional: Add a message for the customer timeline..." class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 h-24 resize-none"></textarea>
        </div>

        <button type="submit" class="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-600 hover:-translate-y-1 transition-all uppercase text-xs tracking-[0.2em] mt-2">Publish Update & Notify</button>
    </form>
`;
    lucide.createIcons();
}

async function handleStatusUpdate(event, orderId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const submitBtn = event.target.querySelector('button');

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-pulse">UPDATING SYSTEM...</span>';

        const response = await authFetch(`${API_BASE_URL}/shipping/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                updatedBy: 'Admin'
            })
        });

        if (!response.ok) throw new Error('Failed to synchronize status');

        showToast('Success: Order status synchronized and customer notified!', 'success');
        await fetchOrders();
        closeModal();
    } catch (error) {
        console.error('Status sync error:', error);
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Update & Notify';
    }
}

async function resendInvoiceEmail(invoiceId) {
    if (!confirm('Authenticate: Resend digital invoice to customer email?')) return;
    try {
        const response = await authFetch(`${API_BASE_URL}/invoices/${invoiceId}/resend`, { method: 'POST' });
        if (!response.ok) throw new Error('Network error during transmission');
        showToast('Invoice dispatched successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}


function showStatusProductDetails(status) {
    const orders = state.orders.filter(o => o.status === status);

    if (orders.length === 0) {
        showToast(`No ${status} orders found`, 'info');
        return;
    }

    // Aggregate products
    const productAggregation = {};
    orders.forEach(order => {
        const items = order.items || [];
        items.forEach(item => {
            const prodName = item.name;
            if (!productAggregation[prodName]) {
                productAggregation[prodName] = {
                    name: prodName,
                    quantity: 0,
                    orders: []
                };
            }
            productAggregation[prodName].quantity += item.quantity;
            productAggregation[prodName].orders.push(order.id);
        });
    });

    const aggregatedList = Object.values(productAggregation).sort((a, b) => b.quantity - a.quantity);

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900 capitalize">${status} Products Detail</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>
        
        <div class="mb-4">
            <p class="text-sm text-gray-500 font-medium">Summary of products from all ${orders.length} ${status} orders.</p>
        </div>

        <div class="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <div class="overflow-x-auto max-h-[60vh]">
                <table class="w-full text-left">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Total Qty</th>
                            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Related Orders</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${aggregatedList.map(prod => `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-6 py-4 text-sm font-medium text-gray-900">${prod.name}</td>
                                <td class="px-6 py-4 text-sm text-center font-bold text-primary">${prod.quantity}</td>
                                <td class="px-6 py-4 text-xs text-gray-500 max-w-xs">
                                    <div class="flex flex-wrap gap-1">
                                        ${prod.orders.map(id => `<span class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono">${id}</span>`).join('')}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="flex justify-end mt-8">
            <button onclick="closeModal()" class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">Close Report</button>
        </div>
    `;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

// ==========================================
// 7. CUSTOMERS PAGE
// ==========================================

function renderCustomers(container) {
    const total = state.customers.length;
    const { currentPage, limit } = state.pagination.customers;

    container.innerHTML = `
        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Customers</h1>
            <p class="text-gray-500 mt-1">View and manage your registered customers</p>
        </div>

        <div id="customers-grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Grid injected here -->
        </div>

        <div id="customers-pagination-container" class="mt-8">
            <!-- Pagination injected here -->
        </div>
    `;

    renderCustomersGrid();
}

function renderCustomersGrid() {
    const { currentPage, limit } = state.pagination.customers;
    const container = document.getElementById('customers-grid-container');
    const paginationContainer = document.getElementById('customers-pagination-container');

    if (!container) return;

    if (state.customers.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white p-12 rounded-2xl border border-gray-100 text-center">
                <i data-lucide="users" class="w-12 h-12 text-gray-200 mx-auto mb-4"></i>
                <p class="text-gray-500 font-medium">No customers found</p>
            </div>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * limit;
    const end = start + limit;
    const paginatedCustomers = state.customers.slice(start, end);

    container.innerHTML = paginatedCustomers.map(customer => `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all group">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
                    ${customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                    <h3 class="font-bold text-gray-900 truncate text-lg group-hover:text-primary transition-colors">${customer.name || 'Anonymous User'}</h3>
                    <p class="text-sm text-gray-500 truncate font-medium">${customer.email}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 mb-6">
                <div class="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                    <p class="text-[10px] text-indigo-500 uppercase font-bold tracking-wider mb-1">Total Orders</p>
                    <p class="text-lg font-black text-gray-900">${customer.orders || 0}</p>
                </div>
                <div class="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                    <p class="text-[10px] text-emerald-500 uppercase font-bold tracking-wider mb-1">Total Spent</p>
                    <p class="text-lg font-black text-gray-900">${formatCurrency(customer.spent || 0)}</p>
                </div>
            </div>
            
            <div class="flex items-center justify-between pt-4 border-t border-gray-50">
                ${renderStatusBadge(customer.status || 'active')}
                <button onclick="openCustomerDetails('${customer._id}')" 
                        class="px-4 py-2 bg-gray-50 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                    Profile <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    `).join('');

    if (paginationContainer) {
        paginationContainer.innerHTML = renderPagination(state.customers.length, currentPage, limit, 'changeAdminPage.customers');
    }

    lucide.createIcons();
}

function openCustomerDetails(id) {
    const customer = state.customers.find(c => c._id === id);
    if (!customer) return;

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900">Customer Profile</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>
        
        <div class="space-y-6">
            <div class="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl">
                    ${customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">${customer.name || 'Anonymous User'}</h3>
                    <p class="text-gray-600">${customer.email}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-gray-50 rounded-xl">
                    <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Phone Number</p>
                    <p class="font-medium text-gray-900">${customer.phone || 'Not provided'}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl">
                    <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Customer Role</p>
                    <p class="font-medium text-gray-900 capitalize">${customer.role || 'customer'}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl">
                    <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Account Status</p>
                    <div class="mt-1">${renderStatusBadge(customer.status || 'active')}</div>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl">
                    <p class="text-xs text-gray-500 uppercase font-semibold mb-1">Verified</p>
                    <p class="font-medium ${customer.isVerified ? 'text-green-600' : 'text-orange-600'} flex items-center gap-1">
                        <i data-lucide="${customer.isVerified ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i>
                        ${customer.isVerified ? 'Verified' : 'Unverified'}
                    </p>
                </div>
            </div>
            
            <div class="border-t border-gray-100 pt-6">
                <h4 class="font-semibold text-gray-900 mb-4">Account Analytics</h4>
                <div class="grid grid-cols-3 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-primary">${customer.orders || 0}</p>
                        <p class="text-xs text-gray-500 uppercase">Total Orders</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-green-600">$${(customer.spent || 0).toFixed(2)}</p>
                        <p class="text-xs text-gray-500 uppercase">LifeTime Spent</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-blue-600">${customer.lastLogin ? new Date(customer.lastLogin).toLocaleDateString() : 'N/A'}</p>
                        <p class="text-xs text-gray-500 uppercase">Last Login</p>
                    </div>
                </div>
            </div>

            <div class="p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex items-start gap-3">
                <i data-lucide="shield-alert" class="w-5 h-5 text-yellow-600 mt-0.5"></i>
                <div>
                    <p class="text-sm font-semibold text-yellow-800">Admin Note</p>
                    <p class="text-xs text-yellow-700 mt-1">
                        This customer joined on ${new Date(customer.createdAt).toLocaleDateString()}. 
                        ${customer.isBlocked ? 'Account is currently blocked from making purchases.' : 'Account is active and in good standing.'}
                    </p>
                </div>
            </div>
        </div>
        
        <div class="flex gap-3 mt-8">
            <button onclick="closeModal()" class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Close Profile</button>
            <button onclick="toggleUserBlock('${customer._id}')" class="flex-1 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors font-medium">
                ${customer.isBlocked ? 'Unblock User' : 'Block User'}
            </button>
        </div>
    `;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

async function toggleUserBlock(id) {
    const customer = state.customers.find(c => c._id === id);
    if (!customer) return;

    const newBlockedStatus = !customer.isBlocked;
    const action = newBlockedStatus ? 'block' : 'unblock';

    if (confirm(`Are you sure you want to ${action} this user?`)) {
        try {
            const response = await authFetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isBlocked: newBlockedStatus })
            });

            if (!response.ok) throw new Error(`Failed to ${action} user`);

            showToast(`User ${action}ed successfully!`, 'success');
            closeModal();
            await fetchCustomers();
        } catch (error) {
            console.error(`Error ${action}ing user:`, error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ==========================================
// 8. REVIEWS PAGE
// ==========================================

function renderReviews(container) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Reviews</h1>
                <p class="text-gray-500 mt-1">Manage product reviews and feedback</p>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50/50">
                        <tr class="border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Product</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">User</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Rating</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Comment</th>
                            <th class="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th class="text-center px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Home Display</th>
                            <th class="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="reviews-table-body" class="divide-y divide-gray-50">
                        <!-- Dynamic content -->
                    </tbody>
                </table>
            </div>
            <div id="reviews-pagination-container"></div>
        </div>
    `;

    renderReviewsTable();
}

function renderReviewsTable() {
    const { currentPage, limit } = state.pagination.reviews;
    const tbody = document.getElementById('reviews-table-body');
    const paginationContainer = document.getElementById('reviews-pagination-container');

    if (!tbody) return;

    if (state.reviews.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center text-gray-400 italic">No reviews found</td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * limit;
    const end = start + limit;
    const paginatedReviews = state.reviews.slice(start, end);

    tbody.innerHTML = paginatedReviews.map(review => {
        const product = state.products.find(p => p._id === review.product || p.id === review.product);
        const productName = product ? product.name : (review.productName || 'Unknown Product');

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 text-sm font-bold text-gray-900">${productName}</td>
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-gray-900">${review.name || 'Anonymous'}</span>
                        <span class="text-[10px] text-gray-400 font-medium">${new Date(review.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${renderStars(review.rating)}
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <div class="max-w-xs truncate" title="${review.comment}">${review.comment}</div>
                </td>
                <td class="px-6 py-4">
                    ${review.isApproved ?
                '<span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-green-100 text-green-700">Approved</span>' :
                '<span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-700">Pending</span>'}
                </td>
                <td class="px-6 py-4">
                    <div class="flex justify-center">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${review.isFeatured ? 'checked' : ''} 
                                   onchange="toggleReviewFeatured('${review._id || review.id}', ${review.isFeatured})">
                            <div class="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        ${!review.isApproved ? `
                            <button onclick="approveReview('${review._id || review.id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-all" title="Approve">
                                <i data-lucide="check" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                        <button onclick="deleteReview('${review._id || review.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (paginationContainer) {
        paginationContainer.innerHTML = renderPagination(state.reviews.length, currentPage, limit, 'changeAdminPage.reviews');
    }

    lucide.createIcons();
}

async function approveReview(id) {
    try {
        const response = await authFetch(`${API_BASE_URL}/reviews/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isApproved: true, status: 'approved' })
        });
        if (response.ok) {
            showToast('Review approved successfully!');
            fetchReviews();
        }
    } catch (error) {
        console.error('Error approving review:', error);
        showToast('Failed to approve review', 'error');
    }
}

async function toggleReviewFeatured(id, currentStatus) {
    try {
        const newStatus = !currentStatus;
        const response = await authFetch(`${API_BASE_URL}/reviews/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isFeatured: newStatus,
                isApproved: newStatus ? true : undefined,
                status: newStatus ? 'approved' : undefined
            })
        });
        if (response.ok) {
            showToast(newStatus ? 'Added to Home Page' : 'Removed from Home Page');
            fetchReviews();
        }
    } catch (error) {
        console.error('Error toggling featured status:', error);
        showToast('Failed to update status', 'error');
    }
}

async function rejectReview(id) {
    try {
        const response = await authFetch(`${API_BASE_URL}/reviews/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' })
        });
        if (!response.ok) throw new Error('Failed to reject review');
        showToast('Status updated!', 'success');
        closeModal();
        await fetchReviews();
    } catch (error) {
        console.error('Error rejecting review:', error);
    }
}

async function deleteReview(id) {
    if (confirm('Are you sure you want to delete this review?')) {
        try {
            const response = await authFetch(`${API_BASE_URL}/reviews/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Review deleted');
                fetchReviews();
            }
        } catch (error) {
            console.error('Error deleting review:', error);
        }
    }
}

// ==========================================
// 9. DISCOUNTS PAGE
// ==========================================

function renderDiscounts(container) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Discounts & Promotions</h1>
                <p class="text-gray-500 mt-1">Manage discount rules and coupons</p>
            </div>
            <button onclick="openDiscountModal()" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-primary/20">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                Add Discount
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.discounts.length === 0 ? `
                <div class="col-span-full bg-white p-12 rounded-2xl border border-gray-100 text-center">
                    <i data-lucide="percent" class="w-12 h-12 text-gray-200 mx-auto mb-4"></i>
                    <p class="text-gray-500 font-medium">No discounts found</p>
                </div>
            ` : state.discounts.map(discount => `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all group">
                    <div class="flex items-start justify-between mb-4">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <i data-lucide="percent" class="w-7 h-7 text-white"></i>
                        </div>
                        ${renderStatusBadge(discount.status)}
                    </div>
                    
                    <h3 class="text-xl font-black text-gray-900 mb-1 group-hover:text-primary transition-colors">${discount.code}</h3>
                    <p class="text-sm text-gray-500 font-bold mb-4">
                        ${discount.type === 'percentage' ? `${discount.value}% OFF` :
            discount.type === 'fixed' ? `${formatCurrency(discount.value)} OFF` :
                'Buy X Get Y Free'}
                    </p>
                    
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between text-gray-500">
                            <span class="font-medium">Min. Order</span>
                            <span class="font-bold text-gray-900">${formatCurrency(discount.minOrder)}</span>
                        </div>
                        <div class="flex justify-between text-gray-500">
                            <span class="font-medium">Total Usage</span>
                            <span class="font-bold text-gray-900">${discount.usage || 0} times</span>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 mt-6 pt-4 border-t border-gray-50">
                        <button onclick="toggleDiscountStatus('${discount._id}')" 
                                class="flex-1 px-3 py-2 text-xs font-bold border border-gray-100 rounded-xl hover:bg-indigo-50 hover:text-primary transition-all">
                            ${discount.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onclick="deleteDiscount('${discount._id}')" 
                                class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    lucide.createIcons();
}

function openDiscountModal() {
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-black text-gray-900">Create Discount</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <i data-lucide="x" class="w-5 h-5 text-gray-400"></i>
            </button>
        </div>

        <form id="discount-form" onsubmit="saveDiscount(event)" class="space-y-6">
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Discount Code</label>
                    <input type="text" name="code" placeholder="SUMMER25" required
                        class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all uppercase font-black text-lg">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Type</label>
                        <select name="type" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none bg-white font-bold text-gray-700">
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount (₹)</option>
                            <option value="bogo">Buy X Get Y</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Value</label>
                        <input type="number" name="value" placeholder="20" required
                            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Minimum Order Amount (₹)</label>
                    <input type="number" name="minOrder" placeholder="999"
                        class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold">
                </div>
            </div>

            <div class="flex gap-3 pt-4">
                <button type="button" onclick="closeModal()" 
                        class="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-bold">Cancel</button>
                <button type="submit" 
                        class="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-primary/20">Create Rule</button>
            </div>
        </form>
    `;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

async function saveDiscount(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const discountData = {
        code: formData.get('code').toUpperCase(),
        type: formData.get('type'),
        value: parseFloat(formData.get('value')),
        minOrder: parseFloat(formData.get('minOrder')) || 0,
        status: 'active',
        usage: 0
    };

    try {
        const response = await authFetch(`${API_BASE_URL}/discounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discountData)
        });
        if (!response.ok) throw new Error('Failed to create discount');
        showToast('Discount created successfully!', 'success');
        closeModal();
        await fetchDiscounts();
    } catch (error) {
        console.error('Error saving discount:', error);
        showToast(error.message, 'error');
    }
}

async function toggleDiscountStatus(id) {
    const discount = state.discounts.find(d => d._id === id);
    if (!discount) return;

    const newStatus = discount.status === 'active' ? 'inactive' : 'active';
    try {
        const response = await authFetch(`${API_BASE_URL}/discounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update discount status');
        showToast(`Discount ${newStatus === 'active' ? 'activated' : 'deactivated'}!`, 'success');
        await fetchDiscounts();
    } catch (error) {
        console.error('Error toggling discount status:', error);
    }
}

async function deleteDiscount(id) {
    if (confirm('Are you sure you want to delete this discount?')) {
        try {
            const response = await authFetch(`${API_BASE_URL}/discounts/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete discount');
            showToast('Discount deleted!', 'success');
            await fetchDiscounts();
        } catch (error) {
            console.error('Error deleting discount:', error);
        }
    }
}


// ==========================================
// 10. OFFER VIDEOS MANAGEMENT
// ==========================================

async function fetchOfferVideos() {
    try {
        const data = await apiFetch('/offer-videos');
        state.offerVideos = data || [];
    } catch (error) {
        console.error('Error fetching offer videos:', error);
        state.offerVideos = []; // Fallback to empty array
    }
}

function renderOffers(container) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Offer Video Showcase</h1>
                <p class="text-gray-500 mt-1">Manage premiums video offers on the homepage</p>
            </div>
            <button onclick="openOfferModal()" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                Add Offer Video
            </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            ${state.offerVideos.length === 0 ? `
                <div class="col-span-full bg-white p-12 rounded-2xl border-2 border-dashed border-gray-100 text-center">
                    <p class="text-gray-500">No offer videos added yet. Click 'Add Offer Video' to start.</p>
                </div>
            ` : state.offerVideos.map(offer => `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row group hover:shadow-lg transition-all">
                    <div class="w-full md:w-32 h-32 bg-black relative">
                    <div class="w-full h-full">
                        ${typeof renderVideoPlayer === 'function' ? renderVideoPlayer(offer.videoUrl) : '<div class="w-full h-full bg-gray-900 flex items-center justify-center text-gray-700 font-medium">Video Preview Unavailable</div>'}
                    </div>
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent flex items-center justify-center transition-all">
                            <i data-lucide="video" class="w-6 h-6 text-white/50"></i>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-6 flex flex-col">
                        <div class="flex justify-between items-start mb-2">
                            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${offer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                                ${offer.isActive ? 'Active' : 'Disabled'}
                            </span>
                            <div class="flex gap-2">
                                <button onclick="openOfferModal('${offer._id}')" class="p-2 text-gray-400 hover:text-primary hover:bg-indigo-50 rounded-lg">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                                <button onclick="deleteOffer('${offer._id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        
                        <h3 class="font-bold text-gray-900 line-clamp-1">${offer.title}</h3>
                        <p class="text-xs text-indigo-600 font-semibold mb-3">${offer.offerText}</p>
                        
                        <div class="mt-auto space-y-2">
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-500">Linked Product:</span>
                                <span class="font-medium text-gray-700">${offer.productId?.name || 'Unknown'}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-gray-500">Expiry Date:</span>
                                <span class="font-medium text-red-600">${new Date(offer.expiryDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <button onclick="toggleOfferStatus('${offer._id}')" 
                                class="mt-4 w-full py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            ${offer.isActive ? 'Disable Offer' : 'Enable Offer'}
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}

function openOfferModal(offerId = null) {
    const offer = offerId ? state.offerVideos.find(o => o._id === offerId) : null;
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900">${offer ? 'Edit Offer Video' : 'Add Offer Video'}</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>

        <form id="offer-form" onsubmit="saveOffer(event, '${offerId || ''}')">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                    <select name="productId" required class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                        <option value="">-- Choose a Product --</option>
                        ${state.products.map(p => `
                            <option value="${p._id}" ${offer && offer.productId?._id === p._id ? 'selected' : ''}>${p.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Video URL (Direct link to MP4)</label>
                    <input type="url" name="videoUrl" value="${offer ? offer.videoUrl : ''}" placeholder="https://example.com/video.mp4" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Offer Title</label>
                    <input type="text" name="title" value="${offer ? offer.title : ''}" placeholder="e.g., Premium iPhone Case Collection" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Offer Sub-text</label>
                    <input type="text" name="offerText" value="${offer ? offer.offerText : ''}" placeholder="e.g., FLAT 30% OFF - TODAY ONLY" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                        <input type="number" name="discountPercentage" value="${offer ? offer.discountPercentage : ''}" placeholder="30"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                        <input type="date" name="expiryDate" value="${offer ? offer.expiryDate.split('T')[0] : ''}" required
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                </div>

                <div class="flex items-center gap-2 pt-2">
                    <input type="checkbox" name="isActive" id="isActive" ${!offer || offer.isActive ? 'checked' : ''} class="w-4 h-4 rounded text-primary focus:ring-primary">
                    <label for="isActive" class="text-sm font-medium text-gray-700">Make Active on Homepage</label>
                </div>
            </div>

            <div class="flex gap-3 mt-8">
                <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    ${offer ? 'Update Offer' : 'Create Offer'}
                </button>
            </div>
        </form>
    `;
    openModal();
    lucide.createIcons();
}

async function saveOffer(event, offerId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
        productId: formData.get('productId'),
        videoUrl: formData.get('videoUrl'),
        title: formData.get('title'),
        offerText: formData.get('offerText'),
        discountPercentage: Number(formData.get('discountPercentage')),
        expiryDate: formData.get('expiryDate'),
        isActive: formData.get('isActive') === 'on'
    };

    try {
        const token = localStorage.getItem('token');
        const url = offerId ? `${API_BASE_URL}/offer-videos/${offerId}` : `${API_BASE_URL}/offer-videos`;
        const method = offerId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast(`Offer video ${offerId ? 'updated' : 'created'} successfully!`, 'success');
            closeModal();
            await fetchOfferVideos();
            renderOffers(document.getElementById('main-content'));
        } else {
            const err = await response.json();
            showToast(err.message, 'error');
        }
    } catch (error) {
        console.error('Error saving offer:', error);
        showToast('Failed to save offer', 'error');
    }
}

async function toggleOfferStatus(id) {
    const offer = state.offerVideos.find(o => o._id === id);
    if (!offer) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/offer-videos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isActive: !offer.isActive })
        });

        if (response.ok) {
            showToast('Offer status updated!', 'success');
            await fetchOfferVideos();
            renderOffers(document.getElementById('main-content'));
        }
    } catch (error) {
        console.error('Error toggling offer status:', error);
    }
}

async function deleteOffer(id) {
    if (!confirm('Are you sure you want to delete this offer video?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/offer-videos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showToast('Offer video deleted', 'success');
            await fetchOfferVideos();
            renderOffers(document.getElementById('main-content'));
        }
    } catch (error) {
        console.error('Error deleting offer:', error);
    }
}

// ==========================================
// 11. SETTINGS PAGE
// ==========================================

function renderSettings(container) {
    container.innerHTML = `
        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
            <p class="text-gray-500 mt-1">Manage your store settings</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-3xl">
            <div class="p-6 border-b border-gray-100">
                <h2 class="text-lg font-semibold text-gray-900">Store Information</h2>
                <p class="text-sm text-gray-500 mt-1">Basic information about your store</p>
            </div>

            <form onsubmit="saveSettings(event)" class="p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                        <input type="text" name="storeName" value="GenziKart Store"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Store Email</label>
                        <input type="email" name="storeEmail" value="contact@genzikart.com"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select name="currency" class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                            <option value="INR" selected>INR (₹)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="USD">USD ($)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                        <input type="number" name="taxRate" value="10" step="0.1"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                </div>

                <div class="pt-4 border-t border-gray-100">
                    <button type="submit" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 font-semibold">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;

    lucide.createIcons();
}

function saveSettings(event) {
    event.preventDefault();
    showToast('Settings saved successfully!', 'success');
    console.log('Settings saved');
}

// ==========================================
// 11. CHARTS INITIALIZATION
// ==========================================

// Chart instances to track for destruction
let revenueChart = null;
let categoryChart = null;

function initCharts() {
    // 1. DATA AGGREGATION - REVENUE
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const revenueByDay = last7Days.map(date => {
        return state.orders
            .filter(o => {
                const orderDate = new Date(o.createdAt || o.date).toISOString().split('T')[0];
                return orderDate === date;
            })
            .reduce((sum, o) => sum + (o.totalAmount || o.total || 0), 0);
    });

    const displayLabels = last7Days.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    });

    // 2. DATA AGGREGATION - CATEGORIES (Weighted by Revenue)
    const categoryTotals = {};
    state.orders.forEach(order => {
        // Only count placed/confirmed/shipped/delivered orders in stats, skip cancelled/returned if preferred
        if (order.orderStatus === 'Cancelled' || order.status === 'cancelled') return;

        (order.items || []).forEach(item => {
            // Find category from state.products or default to 'General'
            const product = state.products.find(p => p._id === item.productId || (p.name && item.name && p.name.trim() === item.name.trim()));
            const category = product ? product.category : 'General';

            // Weight by revenue (Price * Quantity) instead of just unit count
            const itemRevenue = (item.price || 0) * (item.quantity || 1);
            categoryTotals[category] = (categoryTotals[category] || 0) + itemRevenue;
        });
    });

    const catLabels = Object.keys(categoryTotals);
    const catData = Object.values(categoryTotals);

    // If no data, show dummy/placeholder to keep UI pretty
    if (catLabels.length === 0) {
        catLabels.push('No Sales');
        catData.push(1);
    }

    // Revenue Line Chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Revenue',
                    data: revenueByDay,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#4F46E5',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' },
                        ticks: {
                            callback: value => '₹' + value.toLocaleString('en-IN')
                        }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Category Doughnut Chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catData,
                    backgroundColor: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }
}

// ==========================================
// 12. UTILITY FUNCTIONS
// ==========================================

function openModal() {
    document.getElementById('generic-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('generic-modal').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${bgColors[type]} fade-in min-w-[300px]`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5"></i>
        <span class="text-sm font-medium">${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (window.innerWidth >= 1024) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.classList.remove('sidebar-open');
    } else {
        sidebar.classList.add('-translate-x-full');
    }
});

/**
 * ==========================================
 * NOTIFICATIONS PAGE LOGIC
 * ==========================================
 */
let currentNotificationFilter = 'all';
let currentNotificationPage = 1;

async function renderNotificationsPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Direct HTML Injection for immediate rendering matching user design
    mainContent.innerHTML = `
        <div id="notifications-page" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Notifications</h1>
                    <p class="text-sm text-gray-500">Manage all system activity and alerts</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="markAllAsReadPage()" class="px-4 py-2 text-sm font-semibold text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                        Mark all as read
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
                <button onclick="filterNotifications('all')" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${currentNotificationFilter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">All</button>
                <button onclick="filterNotifications('order')" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${currentNotificationFilter === 'order' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">Orders</button>
                <button onclick="filterNotifications('review')" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${currentNotificationFilter === 'review' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">Reviews</button>
                <button onclick="filterNotifications('ticket')" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${currentNotificationFilter === 'ticket' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">Tickets</button>
                <button onclick="filterNotifications('contact')" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${currentNotificationFilter === 'contact' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-600 hover:bg-gray-50'}">Contacts</button>
            </div>

            <!-- Table Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Type</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Notification</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="notifications-table-body" class="divide-y divide-gray-50 text-sm">
                            <!-- Injected rows -->
                        </tbody>
                    </table>
                </div>

                <!-- Footer / Pagination -->
                <div class="p-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between" id="notifications-pagination">
                </div>
            </div>
        </div>
    `;

    loadNotificationsTable();
}

async function loadNotificationsTable(page = 1) {
    currentNotificationPage = page;
    const tbody = document.getElementById('notifications-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400">Loading notifications...</td></tr>';

    try {
        const url = `/notifications?page=${page}&limit=10${currentNotificationFilter !== 'all' ? `&type=${currentNotificationFilter}` : ''}`;
        const res = await apiFetch(url);

        // Save to state so markAsRead can find the full object
        state.pageNotifications = res.notifications;

        if (res.notifications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400 italic">No notifications found in this category</td></tr>';
            return;
        }

        tbody.innerHTML = res.notifications.map(n => `
            <tr class="hover:bg-gray-50/50 transition-colors group cursor-pointer" onclick="markAsRead('${n._id}', '${n.type}', '${n.referenceId}')">
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getNotificationBadgeClass(n.type)}">
                        ${n.type || 'System'}
                    </span>
                </td>
                <td class="px-6 py-4 max-w-sm">
                    <div class="flex flex-col gap-1">
                        <span class="font-bold text-gray-900">${n.title || 'System Notification'}</span>
                        <span class="text-xs text-gray-600 line-clamp-2">${n.message || 'No details available.'}</span>
                        ${n.email || n.phone ? `
                            <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-gray-50">
                                ${n.email ? `<span class="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3 text-primary/50"></i> ${n.email}</span>` : ''}
                                ${n.phone ? `<span class="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-primary/50"></i> ${n.phone}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-500 font-medium">${new Date(n.createdAt).toLocaleDateString()} <span class="text-xs opacity-50 block">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${n.isRead ? 'bg-gray-200' : 'bg-primary'}"></span>
                        <span class="text-xs font-bold tracking-tight ${n.isRead ? 'text-gray-400' : 'text-primary'} uppercase">${n.isRead ? 'Read' : 'Unread'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="event.stopPropagation(); deleteNotificationPage('${n._id}')" class="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        ${!n.isRead ? `<button onclick="event.stopPropagation(); markSingleAsReadPage('${n._id}')" class="p-2 text-gray-400 hover:text-primary rounded-lg transition-colors">
                            <i data-lucide="check-circle" class="w-4 h-4"></i>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        renderPaginationUI(res.total, res.page, res.pages);
        lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

function getNotificationBadgeClass(type) {
    const safeType = (type || 'system').toLowerCase();
    switch (safeType) {
        case 'order': return 'bg-emerald-100 text-emerald-700';
        case 'review': return 'bg-amber-100 text-amber-700';
        case 'ticket': return 'bg-blue-100 text-blue-700';
        case 'contact': return 'bg-purple-100 text-purple-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

function renderPaginationUI(total, page, pages) {
    const container = document.getElementById('notifications-pagination');
    if (!container) return;

    container.innerHTML = `
        <p class="text-xs font-bold text-gray-400 uppercase">Showing ${Math.min(total, (page - 1) * 10 + 1)}-${Math.min(total, page * 10)} of ${total}</p>
        <div class="flex items-center gap-1">
            <button onclick="loadNotificationsTable(${page - 1})" ${page <= 1 ? 'disabled' : ''} class="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-20 transition-all">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <span class="px-3 text-sm font-bold text-gray-700">${page} / ${pages}</span>
            <button onclick="loadNotificationsTable(${page + 1})" ${page >= pages ? 'disabled' : ''} class="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-20 transition-all">
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
        </div>
    `;
    lucide.createIcons();
}

function filterNotifications(type) {
    currentNotificationFilter = type;
    currentNotificationPage = 1;
    renderNotificationsPage();
}

async function markSingleAsReadPage(id) {
    try {
        await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
        loadNotificationsTable(currentNotificationPage);
        fetchUnreadCount();
    } catch (err) {
        showToast("Error update", 'error');
    }
}

async function markAllAsReadPage() {
    try {
        await markAllAsRead();
        renderNotificationsPage();
    } catch (err) {
        console.error('Error marking all as read:', err);
    }
}

async function deleteNotificationPage(id) {
    if (!confirm("Permenently delete this notification?")) return;
    try {
        await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
        showToast("Deleted");
        loadNotificationsTable(currentNotificationPage);
        fetchUnreadCount();
    } catch (err) {
        showToast("Failed to delete", 'error');
    }
}
