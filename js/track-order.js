/**
 * Track Order Page Logic for GenziKart.in
 * Handles real-time status updates and timeline animation
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        showToast('No order ID provided', 'error');
        setTimeout(() => window.location.href = 'my-orders.html', 2000);
        return;
    }

    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    loadOrderTrackingDetails(orderId);
});

async function loadOrderTrackingDetails(id) {
    const content = document.getElementById('trackOrderContent');
    const skeleton = document.getElementById('trackingSkeleton');

    try {
        showSkeleton(true);
        const order = await apiFetch(`/orders/${id}`);
        populateTrackingUI(order);
        showSkeleton(false);
    } catch (err) {
        console.error('Tracking Load Error:', err);
        showToast('Failed to load tracking details', 'error');
        showSkeleton(false);
    }
}

function showSkeleton(show) {
    const content = document.getElementById('trackOrderContent');
    const skeleton = document.getElementById('trackingSkeleton');
    if (show) {
        content.classList.add('hidden');
        skeleton.classList.remove('hidden');
    } else {
        content.classList.remove('hidden');
        skeleton.classList.add('hidden');
    }
}

function populateTrackingUI(order) {
    // Header Info
    const firstItem = order.items[0] || {};
    document.getElementById('orderImg').src = firstItem.image || '';
    document.getElementById('orderProductName').textContent = firstItem.name || 'Genzi Product';
    document.getElementById('orderIdDisplay').textContent = `Order #${order.id}`;
    document.getElementById('orderTotal').textContent = `₹${order.total}`;

    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('orderDate').textContent = `Placed on ${dateStr}`;

    // Badges
    const statusBadge = document.getElementById('orderStatusBadge');
    statusBadge.textContent = order.status;

    // Tracking Info
    document.getElementById('estDeliveryDate').textContent = order.trackingInfo?.estimatedDelivery
        ? new Date(order.trackingInfo.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Calculating...';
    document.getElementById('courierName').textContent = order.trackingInfo?.courierPartner || 'Genzi Logistics';
    document.getElementById('trackingId').textContent = order.trackingInfo?.trackingNumber || 'Awaiting Pickup';

    // Address
    const addr = order.shippingAddress;
    if (addr) {
        document.getElementById('addrName').textContent = addr.name;
        document.getElementById('addrLine1').textContent = addr.line1;
        document.getElementById('addrLine2').textContent = addr.line2 || '';
        document.getElementById('addrCityState').textContent = `${addr.city}, ${addr.state} - ${addr.pincode}`;
        document.getElementById('addrPhone').innerHTML = `<i class="fas fa-phone-alt mr-1"></i> ${addr.phone}`;
    }

    // Timeline Rendering
    renderTimeline(order);

    // Buttons Visibility
    const cancelBtn = document.getElementById('cancelBtn');
    const invoiceBtn = document.getElementById('invoiceBtn');

    if (order.status === 'delivered') {
        cancelBtn.classList.add('hidden');
        invoiceBtn.classList.remove('hidden');
    } else if (order.status === 'cancelled' || order.status === 'returned') {
        cancelBtn.classList.add('hidden');
    }

    // Event Listeners for actions
    cancelBtn.onclick = () => cancelOrderFromTracker(order._id);
    document.getElementById('supportBtn').onclick = () => window.location.href = 'support.html?order=' + order.id;
}

function renderTimeline(order) {
    const container = document.getElementById('timelineContainer');

    // Status Hierarchy for progress
    const stages = ['placed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
    const currentStageIndex = stages.indexOf(order.status);

    const stepConfigs = {
        'placed': { title: 'Order Placed', desc: 'Success! Your order has been received.', icon: 'fa-shopping-bag' },
        'processing': { title: 'Confirmed & Processing', desc: 'Our team is preparing your package.', icon: 'fa-cog' },
        'shipped': { title: 'Shipped', desc: 'Your package is on its way to your city.', icon: 'fa-truck' },
        'out_for_delivery': { title: 'Out for Delivery', desc: 'Delivery partner is arriving today!', icon: 'fa-motorcycle' },
        'delivered': { title: 'Delivered', desc: 'Package handed over to you.', icon: 'fa-check-double' }
    };

    // Special Case: Cancelled/Returned
    if (order.status === 'cancelled') {
        container.innerHTML = `
            <div class="timeline-item active">
                <div class="timeline-dot bg-red-500 border-red-500"></div>
                <div class="timeline-content">
                    <h4 class="font-bold text-red-600">Order Cancelled</h4>
                    <p class="text-xs text-slate-500">This order has been cancelled.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = stages.map((stage, index) => {
        const config = stepConfigs[stage];
        let statusClass = '';
        let dotClass = '';

        if (index < currentStageIndex) {
            statusClass = 'completed';
        } else if (index === currentStageIndex) {
            statusClass = 'active';
            dotClass = 'active-pulse';
        }

        // Find match in actual timeline array for timestamp
        const timelineEntry = order.timeline.find(t => t.status === stage);
        const timeStr = timelineEntry ? new Date(timelineEntry.time).toLocaleString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true }) : '';
        const dayStr = timelineEntry ? new Date(timelineEntry.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

        return `
            <div class="timeline-item ${statusClass}">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-content">
                    <h4 class="font-bold ${statusClass === '' ? 'text-slate-400' : 'text-slate-900'}">${config.title}</h4>
                    <p class="text-xs ${statusClass === '' ? 'text-slate-400' : 'text-slate-500'}">${config.desc}</p>
                    ${timelineEntry ? `<p class="text-[10px] font-black text-amber-500 mt-1 uppercase">${dayStr} • ${timeStr}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function cancelOrderFromTracker(id) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
        await apiFetch(`/orders/${id}/cancel`, { method: 'POST' });
        showToast('Order cancelled successfully', 'success');
        location.reload();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
