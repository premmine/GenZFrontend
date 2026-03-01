let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCartSummary();
    loadProfileAndAddress();
    setupEventListeners();
});

function setupEventListeners() {
    // Address Type Toggle
    document.querySelectorAll('.addr-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.addr-type-btn').forEach(b => {
                b.classList.remove('border-amber-500', 'bg-amber-50', 'text-amber-600');
                b.classList.add('border-slate-100', 'bg-slate-50', 'text-slate-400');
            });
            btn.classList.add('border-amber-500', 'bg-amber-50', 'text-amber-600');
            btn.classList.remove('border-slate-100', 'bg-slate-50', 'text-slate-400');
            document.getElementById('addrType').value = btn.dataset.value;
        });
    });

    // Pincode Auto-fetch
    document.getElementById('addrPincode').addEventListener('input', async (e) => {
        const pin = e.target.value.trim();
        if (pin.length === 6 && /^\d+$/.test(pin)) {
            fetchLocation(pin);
        }
    });

    // Form Submission
    document.getElementById('addressForm').addEventListener('submit', handleFormSubmit);
}

async function loadProfileAndAddress() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = 'login.html';

    try {
        const userEmail = localStorage.getItem('userEmail');
        const users = await apiFetch('/users');
        currentUser = users.find(u => u.email === userEmail);

        if (!currentUser) throw new Error('User not found');

        // Pre-fill profile info
        document.getElementById('addrName').value = currentUser.name || '';
        document.getElementById('addrPhone').value = currentUser.phone || '';
        document.getElementById('addrEmail').value = currentUser.email || '';

        // Pre-fill existing address if available (prefer default)
        const addresses = currentUser.addresses || [];
        const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];

        if (defaultAddr) {
            document.getElementById('addrName').value = defaultAddr.fullName || currentUser.name;
            document.getElementById('addrLine1').value = defaultAddr.houseNo || '';
            document.getElementById('addrLine2').value = defaultAddr.area || '';
            document.getElementById('addrPincode').value = defaultAddr.pincode || '';
            document.getElementById('addrCity').value = defaultAddr.city || '';
            document.getElementById('addrState').value = defaultAddr.state || '';

            // Set type
            const typeValue = defaultAddr.addressType?.toLowerCase() === 'work' ? 'work' : 'home';
            document.getElementById('addrType').value = typeValue;
            const btn = document.getElementById(typeValue === 'home' ? 'typeHome' : 'typeWork');
            if (btn) btn.click();
        }

        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    } catch (err) {
        console.error('Error loading profile:', err);
        showToast('Failed to load profile details', 'error');
    }
}

async function fetchLocation(pincode) {
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();
        if (data[0].Status === "Success") {
            const postOffice = data[0].PostOffice[0];
            document.getElementById('addrCity').value = postOffice.District;
            document.getElementById('addrState').value = postOffice.State;
        }
    } catch (err) {
        console.warn('Location fetch failed', err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('saveAddrBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';

    const addrData = {
        fullName: document.getElementById('addrName').value.trim(),
        phone: document.getElementById('addrPhone').value.trim(),
        pincode: document.getElementById('addrPincode').value.trim(),
        state: document.getElementById('addrState').value.trim(),
        city: document.getElementById('addrCity').value.trim(),
        houseNo: document.getElementById('addrLine1').value.trim(),
        area: document.getElementById('addrLine2').value.trim(),
        addressType: document.getElementById('addrType').value === 'home' ? 'Home' : 'Work'
    };

    try {
        // We always save/update address and then proceed
        // Check if we should update an existing address or just save a new one as default
        const addresses = currentUser.addresses || [];
        const existingAddr = addresses.find(a => a.isDefault) || addresses[0];

        if (existingAddr) {
            // Update existing
            await apiFetch(`/users/address/${existingAddr._id}`, {
                method: 'PUT',
                body: JSON.stringify(addrData)
            });
            localStorage.setItem('selectedAddress', JSON.stringify({ ...existingAddr, ...addrData }));
        } else {
            // Create new
            const res = await apiFetch('/users/address', {
                method: 'POST',
                body: JSON.stringify(addrData)
            });
            // Result from POST address usually contains the new address with _id
            localStorage.setItem('selectedAddress', JSON.stringify(res.address || addrData));
        }

        showToast('Details saved, redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'payment.html';
        }, 1000);
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Reuse cart summary logic
async function loadCartSummary() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const response = await apiFetch('/products');
        const products = response.products || [];

        let subtotal = 0;
        let totalQty = 0;

        cart.forEach(item => {
            const product = products.find(p => p._id === item.productId);
            if (product) {
                subtotal += (product.price * item.quantity);
                totalQty += item.quantity;
            }
        });

        document.getElementById('itemCount').textContent = totalQty;
        document.getElementById('subtotal').textContent = formatCurrency(subtotal);
        // Only set the number for the total span as the ₹ symbol is separately styled in HTML
        document.getElementById('total').textContent = subtotal.toLocaleString('en-IN');
    } catch (err) {
        console.error('Error loading cart summary:', err);
    }
}
