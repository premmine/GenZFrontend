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
        console.log('Fetching users to find:', userEmail);
        const users = await apiFetch('/users');
        console.log('Users fetched:', Array.isArray(users) ? users.length : 'not an array');

        const user = Array.isArray(users) ? users.find(u => u.email === userEmail) : null;

        if (user) {
            console.log('User found:', user.email);
            renderProfile(user);
        } else {
            console.warn('User not found in list, rendering guest');
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

    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');

    if (greetName) greetName.textContent = displayName;
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarEmail) sidebarEmail.textContent = user.email;

    // Avatar Logic: Prefer manual image if exists, else Gravatar
    if (sidebarAvatar) {
        if (user.image) {
            sidebarAvatar.innerHTML = `<img src="${formatImageUrl(user.image)}" class="w-full h-full object-cover rounded-full" alt="${user.name}">`;
        } else {
            const gravatarUrl = getGravatarUrl(user.email);
            sidebarAvatar.innerHTML = `<img src="${gravatarUrl}" class="w-full h-full object-cover rounded-full" alt="${user.name}">`;
        }
        sidebarAvatar.classList.remove('text-5xl');
        sidebarAvatar.style.overflow = 'hidden';
    }
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
    const actualTotal = order.totalAmount || order.total;
    const total = typeof actualTotal === 'number' ? `₹${actualTotal.toLocaleString('en-IN')}` : actualTotal || '—';

    // Get first product image from order items
    const items = order.items || order.products || [];
    const firstImg = items[0]?.image || items[0]?.productImage || '';
    const itemCount = items.length;

    const iconHtml = firstImg
        ? `<div class="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex-shrink-0 relative">
               <img src="${typeof formatImageUrl === 'function' ? formatImageUrl(firstImg) : firstImg}"
                    alt="product"
                    class="w-full h-full object-cover"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div style="display:none" class="w-full h-full absolute inset-0 flex items-center justify-center text-slate-400">
                   <i class="fas fa-box text-sm"></i>
               </div>
               ${itemCount > 1 ? `<span style="position:absolute;top:-4px;right:-4px;background:#f97316;color:#fff;font-size:9px;font-weight:700;border-radius:9999px;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">${itemCount}</span>` : ''}
           </div>`
        : `<div class="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold flex-shrink-0">
               <i class="fas fa-box"></i>
               ${itemCount > 1 ? `<span style="position:absolute;top:-4px;right:-4px;background:#f97316;color:#fff;font-size:9px;font-weight:700;border-radius:9999px;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">${itemCount}</span>` : ''}
           </div>`;

    return `
        <div class="p-6 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="relative">
                    ${iconHtml}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${order.id || 'Order ID'}</h4>
                    <p class="text-xs text-slate-400">${order.date || ''}</p>
                    ${items.length > 0 ? `<p class="text-xs text-slate-500 mt-0.5">${items.length} item${items.length > 1 ? 's' : ''}</p>` : ''}
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

    const status = (order.status || '').toLowerCase();

    // Handle terminal/special statuses
    if (status === 'cancelled' || status === 'returned') {
        const isCancelled = status === 'cancelled';
        result.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Status</p>
                    <h4 class="font-black ${isCancelled ? 'text-red-500' : 'text-amber-500'}">${status.toUpperCase()}</h4>
                </div>
                <button onclick="document.getElementById('trackResult').classList.add('hidden')" class="text-slate-300 hover:text-slate-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100">
                <i class="fas ${isCancelled ? 'fa-ban text-red-400' : 'fa-undo text-amber-400'} text-3xl mb-2"></i>
                <p class="text-sm text-slate-600 font-medium">This order has been ${status}.</p>
                <p class="text-xs text-slate-400 mt-1">If you have questions, please reach out via "Contact Us".</p>
            </div>
        `;
        return;
    }

    const statuses = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
    const statusIndex = statuses.indexOf(status);

    const steps = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered'].map((step, i) => {
        const isDone = i < statusIndex;
        const isActive = i === statusIndex;
        const colorClass = isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400';

        return `
            <div class="flex flex-col items-center gap-1">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${colorClass}">
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

async function submitReturn(e) {
    e.preventDefault();
    const orderId = document.getElementById('returnOrderId')?.value?.trim();
    const reason = document.getElementById('returnReason')?.value;

    if (!orderId || !reason) { showSupportToast('Please fill all required fields', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    try {
        // 1. Find the order by custom ID (Ord-X)
        const orders = await apiFetch('/orders');
        const order = Array.isArray(orders) ? orders.find(o => o.id?.toLowerCase() === orderId.toLowerCase()) : null;

        if (!order) {
            showSupportToast('Order not found. Check the Order ID.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Submit Return Request <i class="fas fa-paper-plane ml-2"></i>';
            }
            return;
        }

        // 2. Call return endpoint using Mongoose _id
        await apiFetch(`/orders/${order._id}/return`, { method: 'POST' });

        showSupportToast('✅ Return request submitted! Processing in 2-3 days.', 'success');
        closeReturnModal();
        e.target.reset();

        // Refresh orders list to show updated status
        loadOrders();

    } catch (err) {
        console.error('Return error:', err);
        showSupportToast(err.message || 'Failed to submit return request', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Submit Return Request <i class="fas fa-paper-plane ml-2"></i>';
        }
    }
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

/* ------------------------------------------------
   6. CONTACT MODAL
   ------------------------------------------------ */
function openContactModal() {
    const m = document.getElementById('contactModal');
    if (m) { m.style.display = 'flex'; }
}

function closeContactModal() {
    const m = document.getElementById('contactModal');
    if (m) { m.style.display = 'none'; }
}

async function submitTicket(e) {
    e.preventDefault();
    const type = document.getElementById('ticketType')?.value;
    const priority = document.getElementById('ticketPriority')?.value;
    const subject = document.getElementById('ticketSubject')?.value?.trim();
    const description = document.getElementById('ticketDetails')?.value?.trim();
    const orderSelect = document.getElementById('ticketOrderSelect');

    // Additional fields from selected order
    const orderId = orderSelect?.value;
    const selectedOption = orderSelect?.options[orderSelect.selectedIndex];
    const productId = selectedOption?.getAttribute('data-product-id');
    const productName = selectedOption?.getAttribute('data-product-name');
    const productImage = selectedOption?.getAttribute('data-product-image');

    // Short values for the backend (matches old category enum)
    // Display labels are shown to users but NOT sent to backend
    const issueTypeBackend = {
        'delivery': 'Delivery',
        'product': 'Product',
        'payment': 'Payment',
        'account': 'Account',
        'other': 'Other'
    };
    // Human-readable display names (stored in issueType field on our new backend)
    const issueTypeDisplay = {
        'delivery': 'Delivery Issue',
        'product': 'Product Quality',
        'payment': 'Payment / Refund',
        'account': 'Account Access',
        'other': 'Other'
    };

    if (!type || !description) {
        showSupportToast('Please fill all required fields', 'error');
        return;
    }

    if (['delivery', 'product', 'payment'].includes(type) && !orderId) {
        showSupportToast('Please select an order for this type of issue', 'error');
        return;
    }

    if (!localStorage.getItem('token')) {
        showSupportToast('Please login first to submit a ticket', 'error');
        return;
    }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const isMongoId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
        const safeProductId = isMongoId(productId) ? productId : undefined;

        const ticketData = {
            // Use the raw HTML select value (lowercase) as both issueType and category
            // These match the old deployed backend's Ticket schema category enum exactly
            issueType: type,          // 'delivery', 'product', 'payment', 'other'
            category: type,           // same — old backend checks this field with enum
            priority: priority || 'medium',
            description: description,
            subject: subject || issueTypeDisplay[type] || 'Support Request',
            orderId: orderId || 'N/A',
            productId: safeProductId,
            productName: productName || 'N/A',
            productImage: productImage || '',
            message: description
        };

        // ✅ Only endpoint that works on deployed backend (1.0.3-diag)
        // Falls back to /support/create-ticket if /tickets fails for other reason
        let submitted = false;
        const endpoints = ['/tickets', '/support/create-ticket'];
        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                await apiFetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify(ticketData)
                });
                submitted = true;
                break;
            } catch (endpointErr) {
                lastError = endpointErr;
                console.warn(`Ticket endpoint ${endpoint} failed, trying next...`);
            }
        }

        if (!submitted) {
            // Show the actual validation error so we know what to fix
            const msg = lastError?.message || 'All ticket endpoints failed';
            throw new Error(msg);
        }

        showSupportToast('✅ Ticket submitted! Our team will respond soon.', 'success');
        closeTicketModal();
        document.getElementById('ticketForm')?.reset();
        document.getElementById('orderSelectorContainer')?.classList.add('hidden');
        document.getElementById('productPreview')?.classList.add('hidden');
        loadTickets();

    } catch (err) {
        console.error('Ticket submission error:', err);
        showSupportToast(err.message || 'Failed to submit ticket. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Submit Ticket <i class="fas fa-paper-plane text-xs"></i>';
        }
    }
}

// Global Order State
let _cachedUserOrders = [];

async function populateOrderDropdown() {
    const select = document.getElementById('ticketOrderSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Loading your orders...</option>';
    select.disabled = true;

    try {
        let orders = null;

        // Try /user/orders first (newer backend), fall back to /orders (older backend)
        try {
            const result = await apiFetch('/user/orders');
            orders = Array.isArray(result) ? result : null;
        } catch (e) {
            // Fallback: /orders returns only the user's own orders (filtered server-side by JWT)
            console.log('Falling back to /orders for order dropdown...');
            const result = await apiFetch('/orders');
            const userEmail = localStorage.getItem('userEmail');
            if (Array.isArray(result)) {
                orders = userEmail ? result.filter(o => o.email === userEmail) : result;
            }
        }

        _cachedUserOrders = orders || [];
        select.disabled = false;
        select.innerHTML = '<option value="">-- Choose an Order --</option>';

        if (_cachedUserOrders.length === 0) {
            select.innerHTML = '<option value="">No orders found</option>';
            return;
        }

        _cachedUserOrders.forEach(order => {
            const items = order.items || order.products || [];
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = order.id;
                option.textContent = `${item.name || 'Product'} | Order: ${order.id}`;
                option.setAttribute('data-product-id', item.productId || item._id || '');
                option.setAttribute('data-product-name', item.name || 'Product');
                option.setAttribute('data-product-image', item.image || item.productImage || '');
                select.appendChild(option);
            });
        });

    } catch (err) {
        select.disabled = false;
        select.innerHTML = '<option value="">Failed to load orders</option>';
        console.warn('Failed to populate orders for ticket:', err.message);
    }
}

function handleOrderSelection(orderId) {
    const preview = document.getElementById('productPreview');
    const select = document.getElementById('ticketOrderSelect');
    if (!preview || !select) return;

    if (!orderId) {
        preview.classList.add('hidden');
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const name = selectedOption.getAttribute('data-product-name');
    const img = selectedOption.getAttribute('data-product-image');

    document.getElementById('previewName').textContent = name;
    document.getElementById('previewId').textContent = `Order #${orderId}`;
    const previewImg = document.getElementById('previewImage');
    if (previewImg) {
        previewImg.src = typeof formatImageUrl === 'function' ? formatImageUrl(img) : img;
    }

    preview.classList.remove('hidden');
}

// Issue Type change listener — called from single DOMContentLoaded below
function initIssueTypeListener() {
    const typeSelect = document.getElementById('ticketType');
    const orderContainer = document.getElementById('orderSelectorContainer');

    if (typeSelect && orderContainer) {
        typeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const needsOrder = ['delivery', 'product', 'payment'].includes(val);

            if (needsOrder) {
                orderContainer.classList.remove('hidden');
                populateOrderDropdown();
            } else {
                orderContainer.classList.add('hidden');
                document.getElementById('productPreview')?.classList.add('hidden');
                const select = document.getElementById('ticketOrderSelect');
                if (select) select.value = '';
            }
        });
    }
}

async function loadTickets() {
    const container = document.getElementById('ticketHistoryContainer');
    if (!container) return;

    if (!localStorage.getItem('token')) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400">
                <i class="fas fa-lock text-3xl mb-3 block opacity-30"></i>
                <p class="font-bold">Please login to view your tickets</p>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="flex items-center gap-2 py-4 text-slate-400 text-sm"><i class="fas fa-spinner fa-spin"></i> Loading tickets...</div>`;

    try {
        // Correct path order: /tickets returns user-scoped for customers (role-based in backend)
        let tickets = null;
        const paths = ['/tickets', '/user/tickets'];

        for (const path of paths) {
            try {
                const result = await apiFetch(path);
                // Result could be an array directly or an object with a tickets property
                tickets = Array.isArray(result) ? result : (result?.tickets || null);
                if (tickets !== null) {
                    console.log(`✅ Tickets loaded from: ${path} (${tickets.length} found)`);
                    break;
                }
            } catch (e) {
                console.warn(`Could not load tickets from ${path}`);
                continue;
            }
        }

        if (!tickets || tickets.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-400">
                    <i class="fas fa-ticket-alt text-3xl mb-3 block opacity-30"></i>
                    <p class="font-bold">No tickets yet</p>
                    <p class="text-sm mt-1">Submit a ticket if you need help with an order</p>
                </div>`;
            return;
        }

        container.innerHTML = tickets.map(t => {
            const replies = t.replies || [];
            const isResolved = ['Resolved', 'Closed'].includes(t.status);
            const statusColors = {
                'Resolved': 'bg-green-100 text-green-600',
                'In Progress': 'bg-amber-100 text-amber-600',
                'Closed': 'bg-gray-200 text-gray-500',
                'Open': 'bg-blue-100 text-blue-600'
            };

            return `
            <div class="p-4 rounded-2xl bg-white border border-slate-100 mb-4 hover:shadow-lg transition-all" id="ticket-${t.ticketId}">
                <div class="flex gap-4">
                    ${t.productImage ? `
                        <div class="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                            <img src="${typeof formatImageUrl === 'function' ? formatImageUrl(t.productImage) : t.productImage}" 
                                 class="w-full h-full object-cover" alt="Product"
                                 onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-slate-300\'><i class=\'fas fa-box\'></i></div>'">
                        </div>
                    ` : ''}
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start mb-1">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">#${t.ticketId}</span>
                                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit mt-1">${t.issueType || t.category || 'Support'}</span>
                            </div>
                            <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColors[t.status] || statusColors['Open']}">${t.status}</span>
                        </div>
                        <h5 class="font-bold text-slate-800 text-sm mt-2">${t.subject || t.issueType || 'Support Ticket'}</h5>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${t.description || t.message || 'No description'}</p>
                        ${t.orderId && t.orderId !== 'N/A' ? `<p class="text-[10px] text-indigo-500 mt-1 font-medium">Order: ${t.orderId}</p>` : ''}
                        
                        <!-- Thread Section -->
                        <div id="thread-${t.ticketId}" class="hidden mt-4 pt-4 border-t border-slate-50 space-y-3">
                            ${replies.length === 0 ? '<p class="text-xs text-slate-400 italic">No messages yet. Admin will reply soon.</p>' : ''}
                            ${replies.map(r => `
                                <div class="flex flex-col ${r.sender === 'admin' ? 'items-start' : 'items-end ml-auto'} max-w-[90%]">
                                    <div class="p-3 rounded-2xl text-xs ${r.sender === 'admin' ? 'bg-indigo-50 text-indigo-700 rounded-tl-none' : 'bg-slate-100 text-slate-700 rounded-tr-none'}">
                                        <p class="font-black text-[9px] uppercase mb-1 opacity-50">${r.sender === 'admin' ? 'Support Team' : 'You'}</p>
                                        ${r.message}
                                    </div>
                                    <span class="text-[9px] text-slate-400 mt-1">${new Date(r.date || r.createdAt || Date.now()).toLocaleString()}</span>
                                </div>
                            `).join('')}

                            ${!isResolved ? `
                                <div class="mt-4 pt-4 border-t border-slate-50">
                                    <textarea id="reply-text-${t.ticketId}" placeholder="Type your message to support..." 
                                        class="w-full p-3 bg-slate-50 border-none rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20"></textarea>
                                    <button onclick="sendTicketReply('${t.ticketId}', this)" 
                                        class="mt-2 w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                        <i class="fas fa-paper-plane text-[10px]"></i> Send Message
                                    </button>
                                </div>
                            ` : `
                                <div class="mt-3 p-3 bg-green-50 rounded-xl">
                                    <p class="text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> This ticket has been ${t.status.toLowerCase()}. Open a new ticket if you need more help.</p>
                                </div>
                            `}
                        </div>

                        <div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                            <button onclick="toggleTicketThread('${t.ticketId}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <i class="fas fa-comments"></i> 
                                ${replies.length > 0 ? `View Conversation (${replies.length})` : 'View Thread'}
                            </button>
                            <p class="text-[10px] text-slate-400 italic">${new Date(t.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load tickets:', err);
        container.innerHTML = `
            <div class="p-8 text-center text-red-400">
                <i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
                <p class="font-bold">Failed to load tickets</p>
                <button onclick="loadTickets()" class="text-xs text-indigo-600 mt-2 underline">Try Again</button>
            </div>`;
    }
}

function toggleTicketThread(id) {
    const thread = document.getElementById(`thread-${id}`);
    if (thread) thread.classList.toggle('hidden');
}

async function sendTicketReply(ticketId, btnEl) {
    const textarea = document.getElementById(`reply-text-${ticketId}`);
    const message = textarea?.value?.trim();
    if (!message) {
        showSupportToast('Please type a message first', 'error');
        return;
    }

    // Use button element passed directly to avoid event context bugs
    const btn = btnEl || document.querySelector(`button[onclick*="sendTicketReply('${ticketId}')"]`);
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    try {
        // Correct endpoint: customers use /tickets/:id/reply (not admin route)
        await apiFetch(`/tickets/${ticketId}/reply`, {
            method: 'PUT',
            body: JSON.stringify({ message })
        });

        showSupportToast('✅ Message sent to support team!', 'success');
        textarea.value = '';
        await loadTickets();
        // Re-open the thread for the same ticket
        const thread = document.getElementById(`thread-${ticketId}`);
        if (thread) thread.classList.remove('hidden');
    } catch (err) {
        console.error('Reply error:', err);
        showSupportToast(err.message || 'Failed to send reply. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<i class="fas fa-paper-plane text-[10px]"></i> Send Message';
        }
    }
}

// ============================================================
// SINGLE DOMContentLoaded — All initialization here
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load User Profile
    loadUserProfile();

    // 2. Load Recent Orders
    loadOrders();

    // 3. Load Support Tickets (only if logged in)
    if (localStorage.getItem('token')) {
        loadTickets();
    }

    // 4. Initialize Issue Type listener for ticket form
    initIssueTypeListener();

    // 5. Click outside modals to close
    window.addEventListener('click', function (e) {
        const returnModal = document.getElementById('returnModal');
        const ticketModal = document.getElementById('ticketModal');
        const contactModal = document.getElementById('contactModal');
        if (e.target === returnModal) closeReturnModal();
        if (e.target === ticketModal) closeTicketModal();
        if (e.target === contactModal) closeContactModal();
    });

    // 6. Pre-fill tracker from URL param ?order=Ord-001
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam) {
        const inp = document.getElementById('trackOrderInput');
        if (inp) { inp.value = orderParam; trackOrder(); }
    }

    // 7. Real-time ticket updates via Socket.IO
    if (window.socket) {
        window.socket.on('newNotification', (notif) => {
            if (notif.type === 'ticket' && localStorage.getItem('token')) {
                loadTickets();
            }
        });
    }
});

async function submitContact(e) {
    e.preventDefault();
    const name = document.getElementById('contactNameUI')?.value?.trim();
    const email = document.getElementById('contactEmailUI')?.value?.trim();
    const phone = document.getElementById('contactPhoneUI')?.value?.trim();
    const subject = document.getElementById('contactSubjectUI')?.value?.trim();
    const message = document.getElementById('contactMessageUI')?.value?.trim();

    if (!name || !email || !subject || !message) {
        showSupportToast('Please fill all fields', 'error');
        return;
    }

    const btn = document.getElementById('contactSubmitBtnUI');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    try {
        await apiFetch('/contact', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, subject, message })
        });

        showSupportToast('✅ Message sent! We\'ll get back to you soon.', 'success');
        closeContactModal();
        e.target.reset();
    } catch (err) {
        showSupportToast(err.message || 'Failed to send message', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Send Message <i class="fas fa-paper-plane text-xs"></i>';
        }
    }
}

// Actions
function downloadInvoice(id) {
    showSupportToast('Generating invoice... Please wait.', 'info');
    // For now, let's just open the order details in a printable format or mock a download
    setTimeout(() => {
        window.open(`${API_BASE_URL}/orders/${id}/invoice`, '_blank');
    }, 1000);
}


// Profile Image Modal
function openProfileImageModal() {
    const modal = document.getElementById('profileImageModal');
    if (modal) modal.style.display = 'flex';
}

function closeProfileImageModal() {
    const modal = document.getElementById('profileImageModal');
    if (modal) modal.style.display = 'none';
}

// ---- Device File Upload helpers ----
let _deviceImageBase64 = null;

function previewAndUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        // Compress image using canvas (max 400px, 80% JPEG quality)
        const img = new Image();
        img.onload = function () {
            const MAX = 400;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            _deviceImageBase64 = canvas.toDataURL('image/jpeg', 0.8);

            const preview = document.getElementById('uploadPreview');
            const previewImg = document.getElementById('uploadPreviewImg');
            const fileName = document.getElementById('uploadFileName');
            if (previewImg) previewImg.src = _deviceImageBase64;
            if (fileName) fileName.textContent = file.name;
            if (preview) preview.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function saveDeviceImage() {
    if (!_deviceImageBase64) {
        showToast('No image selected', 'error');
        return;
    }

    try {
        await apiFetch('/users/me', {
            method: 'PATCH',
            body: JSON.stringify({ image: _deviceImageBase64 })
        });

        // Build userData — pull email from JWT token so renderProfile never crashes
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.image = _deviceImageBase64;
        if (!userData.email) {
            const token = localStorage.getItem('token');
            if (token) {
                try { userData.email = JSON.parse(atob(token.split('.')[1])).email || ''; } catch (e) { }
            }
            if (!userData.email) userData.email = localStorage.getItem('userEmail') || '';
        }
        localStorage.setItem('user', JSON.stringify(userData));

        renderProfile(userData);
        if (typeof updateUserUI === 'function') updateUserUI();

        // Update sidebar avatar immediately
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarAvatar) {
            sidebarAvatar.innerHTML = `<img src="${_deviceImageBase64}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
        }

        showToast('Profile picture updated successfully!');
        closeProfileImageModal();
        _deviceImageBase64 = null;

        // Reset file input and preview
        const fileInput = document.getElementById('deviceImageUpload');
        if (fileInput) fileInput.value = '';
        const preview = document.getElementById('uploadPreview');
        if (preview) preview.classList.add('hidden');

    } catch (error) {
        showToast(error.message || 'Failed to update profile image', 'error');
    }
}

async function updateProfileImage(type) {
    if (type === 'gravatar') {
        let email = '';

        // Try to get email from JWT token (most reliable)
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                email = payload.email || '';
            } catch (e) { /* ignore */ }
        }

        // Fallback to localStorage
        if (!email) {
            email = localStorage.getItem('userEmail') || '';
        }

        if (!email) {
            showToast('User email not found. Please log in again.', 'error');
            return;
        }

        const imageUrl = getGravatarUrl(email);

        try {
            await apiFetch('/users/me', {
                method: 'PATCH',
                body: JSON.stringify({ image: imageUrl })
            });

            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            userData.image = imageUrl;
            localStorage.setItem('user', JSON.stringify(userData));

            renderProfile(userData);
            if (typeof updateUserUI === 'function') updateUserUI();

            // Update sidebar avatar immediately
            const sidebarAvatar = document.getElementById('sidebarAvatar');
            if (sidebarAvatar) {
                sidebarAvatar.innerHTML = `<img src="${imageUrl}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
            }

            showToast('Profile picture synced from Gmail!');
            closeProfileImageModal();
        } catch (error) {
            showToast(error.message || 'Failed to sync profile image', 'error');
        }
    }
}

// Ensure open-modal is accessible globally
window.openProfileImageModal = openProfileImageModal;
window.closeProfileImageModal = closeProfileImageModal;
window.updateProfileImage = updateProfileImage;
window.previewAndUpload = previewAndUpload;
window.saveDeviceImage = saveDeviceImage;

// All initialization is handled in the single DOMContentLoaded above.
// Global function exports for HTML onclick access
window.submitTicket = submitTicket;
window.submitReturn = submitReturn;
window.submitContact = submitContact;
window.sendTicketReply = sendTicketReply;
window.loadTickets = loadTickets;
window.toggleTicketThread = toggleTicketThread;
window.trackOrder = trackOrder;
window.openReturnModal = openReturnModal;
window.closeReturnModal = closeReturnModal;
window.openTicketModal = openTicketModal;
window.closeTicketModal = closeTicketModal;
window.openContactModal = openContactModal;
window.closeContactModal = closeContactModal;
window.prefillTrack = prefillTrack;
window.handleOrderSelection = handleOrderSelection;

