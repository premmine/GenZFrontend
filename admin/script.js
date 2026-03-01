const API_BASE_URL = 'https://gen-z-backend.vercel.app/api';

const state = {
    currentPage: 'dashboard',
    products: [],
    orders: [],
    customers: [],
    reviews: [],
    discounts: [],
    offerVideos: [],
    stats: {
        sales: 0,
        salesChange: 0,
        orders: 0,
        ordersChange: 0,
        products: 0,
        productsChange: 0,
        customers: 0,
        customersChange: 0
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
});

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

async function fetchAllData() {
    try {
        await Promise.all([
            fetchProducts(),
            fetchOrders(),
            fetchCustomers(),
            fetchReviews(),
            fetchDiscounts(),
            fetchOfferVideos()
        ]);
        updateStats();
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showToast('Session expired. Please login again.', 'error');
        // window.location.href = 'login.html';
    }
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
        const response = await authFetch(`${API_BASE_URL}/reviews`);
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
    state.stats.sales = state.orders.reduce((acc, order) => acc + (order.total || 0), 0);

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
                                    <td class="py-3 text-sm text-gray-900 text-right font-medium">${formatCurrency(order.total)}</td>
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
                                ${review.user.charAt(0)}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <p class="text-sm font-medium text-gray-900">${review.user}</p>
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
        'processing': 'bg-blue-100 text-blue-700',
        'shipped': 'bg-indigo-100 text-indigo-700',
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

    const style = styles[status] || 'bg-gray-100 text-gray-700';
    const label = status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}">${label}</span>`;
}

function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i data-lucide="star" class="w-3 h-3 text-yellow-400 fill-current"></i>';
        } else {
            stars += '<i data-lucide="star" class="w-3 h-3 text-gray-300"></i>';
        }
    }
    return stars;
}

// ==========================================
// 5. PRODUCTS PAGE
// ==========================================

function renderProducts(container) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Products</h1>
                <p class="text-gray-500 mt-1">Manage your product inventory</p>
            </div>
            <button onclick="openProductModal()" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                Add New Product
            </button>
        </div>
        
        <!-- Filters & Search -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                        <input type="text" id="product-search" placeholder="Search products..." 
                                                        class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                </div>
                <div class="flex gap-2">
                    <select id="stock-filter" class="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                        <option value="all">All Stock</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Products Table -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body" class="divide-y divide-gray-100">
                        <!-- Dynamic Content -->
                    </tbody>
                </table>
            </div>
            
            <!-- Pagination -->
            <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p class="text-sm text-gray-500">Showing <span class="font-medium">1</span> to <span class="font-medium">${state.products.length}</span> of <span class="font-medium">${state.products.length}</span> results</p>
                <div class="flex gap-2">
                    <button class="px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled>Previous</button>
                    <button class="px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Next</button>
                </div>
            </div>
        </div>
    `;

    renderProductsTable();

    // Add event listeners
    document.getElementById('product-search').addEventListener('input', filterProducts);
    document.getElementById('stock-filter').addEventListener('change', filterProducts);
}

function renderProductsTable(filteredProducts = null) {
    const products = filteredProducts || state.products;
    const tbody = document.getElementById('products-table-body');

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <i data-lucide="package" class="w-12 h-12 text-gray-300 mb-4"></i>
                        <p class="text-gray-500">No products found</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="${product.image}" alt="${product.name}" class="w-10 h-10 rounded-lg object-cover">
                    <span class="font-medium text-gray-900">${product.name}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${product.sku}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${formatCurrency(product.price)}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${product.stock}</td>
            <td class="px-6 py-4">${renderStatusBadge(product.status)}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editProduct('${product._id || product.id}')" class="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteProduct('${product._id || product.id}')" class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    lucide.createIcons();
}

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
                <button onclick="showStatusProductDetails('delivered')" class="inline-flex items-center px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium">
                    <i data-lucide="package-check" class="w-4 h-4 mr-2"></i>
                    Delivered Details
                </button>
                <button onclick="showStatusProductDetails('returned')" class="inline-flex items-center px-4 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium">
                    <i data-lucide="rotate-ccw" class="w-4 h-4 mr-2"></i>
                    Return Details
                </button>
            </div>
        </div>
        
        <!-- Filters -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div class="flex flex-wrap gap-4">
                <div class="flex-1 min-w-[200px]">
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                        <input type="text" id="order-search" placeholder="Search orders..." 
                            class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                </div>
                <select id="status-filter" class="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
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
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body" class="divide-y divide-gray-100">
                        <!-- Dynamic Content -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    renderOrdersTable();
    document.getElementById('order-search').addEventListener('input', filterOrders);
    document.getElementById('status-filter').addEventListener('change', filterOrders);
}

function renderOrdersTable(filteredOrders = null) {
    const orders = filteredOrders || state.orders;
    const tbody = document.getElementById('orders-table-body');

    if (!tbody) return;

    tbody.innerHTML = orders.map(order => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm font-medium text-primary">${order.id}</td>
            <td class="px-6 py-4">
                <div>
                    <p class="text-sm font-medium text-gray-900">${order.customer}</p>
                    <p class="text-xs text-gray-500">${order.email}</p>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${order.date}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${formatCurrency(order.total)}</td>
            <td class="px-6 py-4">${renderStatusBadge(order.payment)}</td>
            <td class="px-6 py-4">${renderStatusBadge(order.status)}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="openOrderDetails('${order._id}')" class="text-primary hover:underline text-sm font-medium">View Info</button>
            </td>
        </tr>
    `).join('');
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

function openOrderDetails(id) {
    const order = state.orders.find(o => o._id === id);
    if (!order) return;

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">Order Details</h2>
        <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
        </button>
    </div>
    
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row gap-6 md:items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
                <p class="text-xs text-gray-500 uppercase font-semibold">Order ID</p>
                <p class="font-medium text-primary">${order.id}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 uppercase font-semibold">Order Date</p>
                <p class="font-medium text-gray-900">${order.date}</p>
            </div>
        </div>
        
        <div class="border border-gray-200 rounded-lg overflow-hidden">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${(order.items || []).length > 0 ? order.items.map(item => `
                        <tr>
                            <td class="px-4 py-3 text-sm">${item.name}</td>
                            <td class="px-4 py-3 text-sm text-right">${item.quantity}</td>
                            <td class="px-4 py-3 text-sm text-right">${formatCurrency(item.price)}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="3" class="px-4 py-3 text-sm text-center text-gray-500">No items found</td>
                        </tr>
                    `}
                </tbody>
                <tfoot class="bg-gray-50">
                    <tr>
                        <td colspan="2" class="px-4 py-3 text-sm font-medium text-gray-900 text-right">Total</td>
                        <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">${formatCurrency(order.total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
                <p class="text-xs text-gray-500 uppercase">Payment Status</p>
                <div class="mt-1">${renderStatusBadge(order.payment)}</div>
            </div>
            <div>
                <p class="text-xs text-gray-500 uppercase">Order Status</p>
                <div class="mt-1">${renderStatusBadge(order.status)}</div>
            </div>
        </div>
    </div>
    
    <div class="flex gap-3 mt-6">
        <button onclick="closeModal()" class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
        <button onclick="updateOrderStatus('${order._id}'); closeModal();" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">Update Status</button>
    </div>
`;

    document.getElementById('generic-modal').classList.remove('hidden');
    lucide.createIcons();
}

async function updateOrderStatus(id) {
    const order = state.orders.find(o => o._id === id);
    if (!order) return;

    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const currentIndex = statuses.indexOf(order.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const newStatus = statuses[nextIndex];

    try {
        const response = await authFetch(`${API_BASE_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update order status');

        showToast(`Order status updated to ${newStatus}`, 'success');
        await fetchOrders();
    } catch (error) {
        console.error('Error updating order status:', error);
        showToast('Error updating status', 'error');
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
    container.innerHTML = `
        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Customers</h1>
            <p class="text-gray-500 mt-1">View and manage your registered customers</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.customers.map(customer => `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            ${customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-gray-900 truncate">${customer.name || 'Anonymous'}</h3>
                            <p class="text-sm text-gray-500 truncate">${customer.email}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500 uppercase font-semibold">Orders</p>
                            <p class="text-lg font-bold text-gray-900">${customer.orders || 0}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500 uppercase font-semibold">Spent</p>
                            <p class="text-lg font-bold text-gray-900">$${(customer.spent || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        ${renderStatusBadge(customer.status || 'active')}
                        <button onclick="openCustomerDetails('${customer._id}')" class="text-primary hover:underline text-sm font-semibold flex items-center gap-1">
                            View Profile <i data-lucide="chevron-right" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

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
            <p class="text-gray-500 mt-1">Manage product reviews</p>
        </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comment</th>
                            <th class="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Show on Home</th>
                            <th class="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${state.reviews.map(review => {
        const product = state.products.find(p => p._id === review.product || p.id === review.product);
        const productName = product ? product.name : review.product;
        return `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-6 py-4 text-sm font-medium text-gray-900">${productName}</td>
                                <td class="px-6 py-4 text-sm text-gray-600">${review.user}</td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-1">
                                        ${renderStars(review.rating)}
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">${review.comment}</td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-2">
                                        ${review.isApproved ? '<span class="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase">Approved</span>' : '<span class="bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase">Pending</span>'}
                                        ${review.isFeatured ? '<span class="bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Featured</span>' : ''}
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <div class="flex justify-center">
                                        <label class="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" class="sr-only peer" ${review.isFeatured ? 'checked' : ''} 
                                                   onchange="toggleReviewFeatured('${review._id || review.id}', ${review.isFeatured || false})">
                                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                        </label>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        ${!review.isApproved ? `
                                            <button onclick="approveReview('${review._id || review.id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                                                <i data-lucide="check" class="w-4 h-4"></i>
                                            </button>
                                            <button onclick="rejectReview('${review._id || review.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                                                <i data-lucide="x" class="w-4 h-4"></i>
                                            </button>
                                        ` : `
                                            <button onclick="deleteReview('${review._id || review.id}')" class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                            </button>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        `;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

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
            // If featuring, also ensure it's approved
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
        showToast('Review rejected!', 'success');
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
            <button onclick="openDiscountModal()" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                Add Discount
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.discounts.map(discount => `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between mb-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <i data-lucide="percent" class="w-6 h-6 text-white"></i>
                        </div>
                        ${renderStatusBadge(discount.status)}
                    </div>
                    
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${discount.code}</h3>
                    <p class="text-sm text-gray-500 mb-4">
                        ${discount.type === 'percentage' ? `${discount.value}% OFF` :
            discount.type === 'fixed' ? `$${discount.value} OFF` :
                'Buy X Get Y Free'}
                    </p>
                    
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between text-gray-600">
                            <span>Min. Order</span>
                            <span class="font-medium">$${discount.minOrder}</span>
                        </div>
                        <div class="flex justify-between text-gray-600">
                            <span>Usage</span>
                            <span class="font-medium">${discount.usage} times</span>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                        <button onclick="toggleDiscountStatus('${discount._id}')" class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            ${discount.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onclick="deleteDiscount('${discount._id}')" class="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
            <h2 class="text-xl font-bold text-gray-900">Create Discount</h2>
            <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
            </button>
        </div>

        <form id="discount-form" onsubmit="saveDiscount(event)">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Discount Code</label>
                    <input type="text" name="code" placeholder="e.g., SUMMER20" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                    <select name="type" class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                        <option value="bogo">Buy X Get Y</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    <input type="number" name="value" placeholder="20" required
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Order Amount ($)</label>
                    <input type="number" name="minOrder" placeholder="0"
                        class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">Create Discount</button>
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

function toggleDiscountStatus(id) {
    const discount = state.discounts.find(d => d.id === id);
    if (discount) {
        discount.status = discount.status === 'active' ? 'inactive' : 'active';
        showToast(`Discount ${discount.status}!`, 'success');
        renderDiscounts();
    }
}

function deleteDiscount(id) {
    if (confirm('Are you sure you want to delete this discount?')) {
        state.discounts = state.discounts.filter(d => d.id !== id);
        showToast('Discount deleted!', 'success');
        renderDiscounts();
    }
}

// ==========================================
// 10. OFFER VIDEOS MANAGEMENT
// ==========================================

async function fetchOfferVideos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/offer-videos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        state.offerVideos = await response.json();
    } catch (error) {
        console.error('Error fetching offer videos:', error);
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
    < div class= "mb-8" >
            <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
            <p class="text-gray-500 mt-1">Manage your store settings</p>
        </div >

        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-3xl">
            <div class="p-6 border-b border-gray-100">
                <h2 class="text-lg font-semibold text-gray-900">Store Information</h2>
                <p class="text-sm text-gray-500 mt-1">Basic information about your store</p>
            </div>

            <form onsubmit="saveSettings(event)" class="p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                        <input type="text" value="GenziKart Store"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Store Email</label>
                        <input type="email" value="contact@genzikart.com"
                            class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                            <option value="INR" selected>INR (₹)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="USD">USD ($)</option>

                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)
                            <input type="number" value="10" step="0.1"
                                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                            </div>
                    </div>

                    <div class="pt-4 border-t border-gray-100">
                        <button type="submit" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors">
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
            .filter(o => o.date === date || (o.createdAt && o.createdAt.startsWith(date)))
            .reduce((sum, o) => sum + o.total, 0);
    });

    const displayLabels = last7Days.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    });

    // 2. DATA AGGREGATION - CATEGORIES
    const categoryTotals = {};
    state.orders.forEach(order => {
        (order.items || []).forEach(item => {
            // Find category from state.products or default to 'Other'
            const product = state.products.find(p => p._id === item.productId || p.name === item.name);
            const category = product ? product.category : 'General';
            categoryTotals[category] = (categoryTotals[category] || 0) + item.quantity;
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