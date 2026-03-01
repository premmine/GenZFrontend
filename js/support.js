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
    const total = typeof order.total === 'number' ? `₹${order.total.toLocaleString('en-IN')}` : order.total || '—';

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

    const statuses = ['placed', 'processing', 'shipped', 'delivered'];
    const statusIndex = statuses.indexOf(status);

    const steps = ['Placed', 'Processing', 'Shipped', 'Delivered'].map((step, i) => {
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
    const details = document.getElementById('ticketDetails')?.value?.trim();

    if (!type || !subject || !details) { showSupportToast('Please fill all fields', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const ticketData = {
            subject,
            category: type === 'delivery' ? 'Delivery' :
                type === 'product' ? 'Technical Issue' :
                    type === 'payment' ? 'Payment' : 'Other',
            message: details,
            priority // Optional field in controller? No, I'll stick to model Category.
        };

        await apiFetch('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });

        showSupportToast('✅ Ticket submitted! We\'ll reply within 24 hours.', 'success');
        closeTicketModal();
        document.getElementById('ticketForm')?.reset();

        // Refresh ticket history if it exists
        if (typeof loadTickets === 'function') loadTickets();

    } catch (err) {
        console.error('Ticket error:', err);
        showSupportToast(err.message || 'Failed to submit ticket', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Submit Ticket <i class="fas fa-paper-plane ml-2"></i>';
        }
    }
}

async function loadTickets() {
    const container = document.getElementById('ticketHistoryContainer');
    if (!container) return;

    try {
        const tickets = await apiFetch('/tickets');
        if (!tickets || tickets.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm italic">No tickets found.</p>`;
            return;
        }

        container.innerHTML = tickets.map(t => `
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-3">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">#${t.ticketId}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t.status === 'Open' ? 'bg-blue-100 text-blue-600' :
                t.status === 'Resolved' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'
            }">${t.status}</span>
                </div>
                <h5 class="font-bold text-slate-800 text-sm">${t.subject}</h5>
                <p class="text-xs text-slate-500 mt-1 line-clamp-2">${t.message}</p>
                <p class="text-[10px] text-slate-400 mt-2 italic">${new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
        `).join('');
    } catch (err) {
        console.warn('Failed to load tickets', err);
    }
}


/* ------------------------------------------------
   INIT
   ------------------------------------------------ */
var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

document.addEventListener('DOMContentLoaded', () => {
    // Basic init
    loadUserProfile();
    loadOrders();
    loadTickets();

    // Click outside modals to close
    window.addEventListener('click', function (e) {
        const returnModal = document.getElementById('returnModal');
        const ticketModal = document.getElementById('ticketModal');
        const contactModal = document.getElementById('contactModal');
        if (e.target === returnModal) closeReturnModal();
        if (e.target === ticketModal) closeTicketModal();
        if (e.target === contactModal) closeContactModal();
    });

    // Pre-fill tracker from URL param ?order=Ord-001
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam) {
        const inp = document.getElementById('trackOrderInput');
        if (inp) { inp.value = orderParam; trackOrder(); }
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

