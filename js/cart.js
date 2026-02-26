/* =========================================
   STABLE CART ENGINE – PRODUCTION STYLE
========================================= */

const FREE_GIFT_THRESHOLD = 1499;

const FREE_GIFT = {
    id: 'gift',
    name: 'Premium Phone Cleaning Kit (FREE)',
    price: 0,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=150&h=150&fit=crop',
    isGift: true
};

let cart = [];
let products = [];

/* =========================================
   LOAD PRODUCTS + CART
========================================= */

async function loadCart() {
    try {
        // Fetch real products from MongoDB
        const response = await apiFetch("/products");
        products = response.products || []; // Extract from nested products array

        const storedCart = JSON.parse(localStorage.getItem('cart') || '[]');

        // ✅ Rebuild full cart from minimal localStorage using MongoDB _id
        cart = storedCart.map(item => {
            const product = products.find(p => p._id === item.productId);
            if (!product) return null;

            return {
                ...product,
                id: product._id,
                quantity: Math.min(item.quantity, 999) // sanity cap
            };
        }).filter(Boolean);

        // Sync with backend ONLY when local cart is empty (cross-device / new login)
        // If local cart has items already, trust it and push to backend instead.
        if (localStorage.getItem('token')) {
            if (cart.length === 0) {
                // Local cart empty → try to restore from backend
                const dbCart = await apiFetch("/cart").catch(() => null);
                if (dbCart && Array.isArray(dbCart.items) && dbCart.items.length > 0) {
                    restoreFromBackend(dbCart.items);
                }
            } else {
                // Local cart has items → push local state to backend (overwrite)
                syncLocalToBackend();
            }
        }

        applyGiftLogic();
        displayCart();
        updateOrderSummary();
        updateCartBadge();

    } catch (err) {
        console.error("Cart Load Error:", err);
        showToast("Error loading cart", "error");
    }
}

/**
 * Restore cart from backend when local cart is empty (e.g. logged in on new device)
 * Sanity-caps quantities to prevent corrupted data from showing up.
 */
function restoreFromBackend(dbItems) {
    dbItems.forEach(dbItem => {
        const product = products.find(p => p._id === dbItem.productId);
        if (product && dbItem.quantity > 0) {
            const safQty = Math.min(dbItem.quantity, 999); // hard cap
            cart.push({ ...product, id: product._id, quantity: safQty });
        }
    });
    saveCart();
}

/**
 * Push the current local cart to the backend, overwriting stale server data.
 */
function syncLocalToBackend() {
    const minimalCart = cart
        .filter(i => !i.isGift)
        .map(i => ({ productId: i.id, quantity: i.quantity }));

    apiFetch('/cart/merge', {
        method: 'POST',
        body: JSON.stringify({ localCart: minimalCart })
    }).catch(err => console.error('Backend sync failed:', err));
}

/* =========================================
   SAVE CART (MINIMAL FORMAT ONLY)
========================================= */

function saveCart() {
    const minimalCart = cart
        .filter(i => !i.isGift)
        .map(i => ({
            productId: i.id,
            quantity: i.quantity
        }));

    localStorage.setItem("cart", JSON.stringify(minimalCart));

    // Sync to backend if logged in
    if (localStorage.getItem('token')) {
        apiFetch('/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ localCart: minimalCart })
        }).catch(err => console.error('Backend sync failed:', err));
    }
}

/* =========================================
   DISPLAY CART
========================================= */

function displayCart() {

    const container = document.getElementById('cartItemsContainer');
    const emptyMessage = document.getElementById('emptyCartMessage');

    const regularItems = cart.filter(item => !item.isGift);

    if (regularItems.length === 0) {
        container.classList.add('hidden');
        emptyMessage.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    emptyMessage.classList.add('hidden');

    container.innerHTML = cart.map(item => createCartItemHTML(item)).join('');
}

/* =========================================
   CART ITEM UI
========================================= */

function createCartItemHTML(item) {

    return `
        <div class="bg-white rounded-lg p-4 flex gap-4 shadow-sm">

            <img src="${item.image}" class="w-24 h-24 object-cover rounded-lg">

            <div class="flex-1">

                <div class="flex justify-between mb-2">
                    <h3 class="font-semibold">${item.name}</h3>

                    ${!item.isGift ? `
                        <button onclick="removeFromCart('${item.id}')" class="text-red-500">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <span class="text-green-600 text-sm">FREE GIFT</span>
                    `}
                </div>

                <div class="flex justify-between items-center">

                    <span class="text-lg font-bold text-amber-600">
                        ₹${item.price * item.quantity}
                    </span>

                    ${!item.isGift ? `
                        <div class="flex items-center gap-3">
                            <button onclick="updateQuantity('${item.id}', -1)">−</button>
                            <span>${item.quantity}</span>
                            <button onclick="updateQuantity('${item.id}', 1)">+</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/* =========================================
   QUANTITY ENGINE
========================================= */

function updateQuantity(productId, change) {

    const item = cart.find(i => i.id === productId);
    if (!item || item.isGift) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }

    applyGiftLogic();
    saveCart();
    displayCart();
    updateOrderSummary();
    updateCartBadge();
}

function removeFromCart(productId) {

    cart = cart.filter(item => item.id !== productId);

    applyGiftLogic();
    saveCart();
    displayCart();
    updateOrderSummary();
    updateCartBadge();

    showToast('Item removed');
}

/* =========================================
   ORDER SUMMARY
========================================= */

function updateOrderSummary() {

    const regularItems = cart.filter(item => !item.isGift);

    const subtotal = regularItems.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
    );

    document.getElementById('subtotal').textContent = '₹' + subtotal;
    document.getElementById('total').textContent = '₹' + subtotal;

    updateGiftUI(subtotal);
}

/* =========================================
   FREE GIFT ENGINE
========================================= */

function applyGiftLogic() {

    cart = cart.filter(item => !item.isGift);

    const subtotal = cart.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
    );

    if (subtotal >= FREE_GIFT_THRESHOLD) {
        cart.push(FREE_GIFT);
    }
}

function updateGiftUI(subtotal) {

    const remaining = FREE_GIFT_THRESHOLD - subtotal;
    const progress = Math.min((subtotal / FREE_GIFT_THRESHOLD) * 100, 100);

    document.getElementById('giftProgressBar').style.width = progress + '%';

    if (subtotal >= FREE_GIFT_THRESHOLD) {
        document.getElementById('giftMessage').textContent =
            "Free gift unlocked!";
    } else {
        document.getElementById('giftMessage').textContent =
            `Add ₹${remaining} more to get FREE gift`;
    }
}

/* =========================================
   BADGE
========================================= */

function updateCartBadge() {

    const badge = document.getElementById('cartBadge');
    if (!badge) return;

    const regularItems = cart.filter(item => !item.isGift);

    const totalQty = regularItems.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    badge.textContent = totalQty;
}

/* =========================================
   INIT
========================================= */

document.addEventListener('DOMContentLoaded', loadCart);


document.getElementById("checkoutBtn")?.addEventListener("click", function () {

    const regularItems = cart.filter(item => !item.isGift);

    if (!regularItems.length) {
        showToast("Cart is empty");
        return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    window.location.href = "address.html";
});