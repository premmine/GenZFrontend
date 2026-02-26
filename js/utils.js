// Utility Functions for GenziKart E-commerce

const API_BASE_URL = 'https://gen-z-backend.vercel.app/api';

/**
 * Formats an image URL for display.
 * Converts Google Drive "view" links to direct image links.
 */
function formatImageUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // Handle Google Drive links
    if (url.includes('drive.google.com')) {
        const driveIdMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
            const fileId = driveIdMatch[1];
            // Using thumbnail link is more reliable for bypassing Google's "large file" warning
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    }
    return url;
}

/**
 * Enhanced fetch wrapper for API calls
 * Handles JSON parsing and authorization headers
 */
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

const avatars = ["🧑‍💼", "😎", "🧑‍💻", "👑"];

// Update cart badge
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = totalItems;
        if (totalItems > 0) {
            badge.classList.add('bounce');
            setTimeout(() => badge.classList.remove('bounce'), 500);
        }
    }
}

// Update wishlist badge
function updateWishlistBadge() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const badge = document.getElementById('wishlistBadge');
    if (badge) {
        badge.textContent = wishlist.length;
        if (wishlist.length > 0) {
            badge.classList.add('bounce');
            setTimeout(() => badge.classList.remove('bounce'), 500);
        }
    }
}

/**
 * Premium Modal Alert System
 * @param {string} message - Message to display
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showModalAlert(message, type = 'info') {
    // Remove existing alert if any
    const existing = document.getElementById('modal-alert');
    if (existing) existing.remove();

    const colors = {
        success: { bg: 'bg-emerald-500', icon: 'fa-check-circle', shadow: 'shadow-emerald-500/30' },
        error: { bg: 'bg-rose-500', icon: 'fa-exclamation-circle', shadow: 'shadow-rose-500/30' },
        info: { bg: 'bg-blue-500', icon: 'fa-info-circle', shadow: 'shadow-blue-500/30' }
    };

    const config = colors[type] || colors.info;

    const modal = document.createElement('div');
    modal.id = 'modal-alert';
    modal.className = 'fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all animate-in zoom-in-95 duration-300">
            <div class="${config.bg} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl shadow-lg ${config.shadow}">
                <i class="fas ${config.icon}"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-2 capitalize">${type}</h3>
            <p class="text-slate-600 mb-6">${message}</p>
            
            <button id="closeModalAlertBtn" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-all border border-slate-200">
                Close
            </button>
            
            <div class="mt-4 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div id="alertTimerBar" class="${config.bg} h-full w-full transition-all duration-[3000ms] ease-linear"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.add('animate-out', 'fade-out', 'zoom-out-95');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('closeModalAlertBtn').addEventListener('click', closeModal);

    // Auto close
    setTimeout(() => {
        const bar = document.getElementById('alertTimerBar');
        if (bar) bar.style.width = '0%';
    }, 10);

    const autoCloseTimeout = setTimeout(closeModal, 3000);

    // Stop auto-close if manually closed
    document.getElementById('closeModalAlertBtn').addEventListener('click', () => {
        clearTimeout(autoCloseTimeout);
    });
}

/**
 * Toast helper (wraps showModalAlert)
 */
function showToast(message, type = 'success') {
    showModalAlert(message, type);
}

/**
 * Error helper (wraps showModalAlert)
 */
function showError(message) {
    showModalAlert(message, 'error');
}

// Authentication Check
function isLoggedIn() {
    return !!localStorage.getItem('token');
}

// Show Authentication Required Modal
function showAuthModal(action = "perform this action") {
    // Remove existing modal if any
    const existingModal = document.getElementById('authGateModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'authGateModal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-lock text-3xl text-amber-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-2">Login Required</h2>
            <p class="text-slate-600 mb-6">Please login to ${action}. You will be redirected shortly.</p>
            
            <div class="flex flex-col gap-3">
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div id="authModalProgress" class="bg-amber-500 h-full w-0 transition-all duration-[3000ms] ease-linear"></div>
                </div>
                <p id="authCountdown" class="text-sm font-semibold text-amber-600">Redirecting in 3 seconds...</p>
            </div>

            <a href="login.html" class="mt-8 block w-full bg-amber-500 text-white py-3 rounded-full font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/30">
                Go to Login Now
            </a>
        </div>
    `;

    document.body.appendChild(modal);

    // Trigger progress bar
    setTimeout(() => {
        const bar = document.getElementById('authModalProgress');
        if (bar) bar.style.width = '100%';
    }, 50);

    // Countdown and Redirect
    let secondsLeft = 3;
    const interval = setInterval(() => {
        secondsLeft--;
        const countdownLine = document.getElementById('authCountdown');
        if (countdownLine) {
            countdownLine.textContent = `Redirecting in ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}...`;
        }

        if (secondsLeft <= 0) {
            clearInterval(interval);
            window.location.href = 'login.html';
        }
    }, 1000);
}

// Format currency
function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

/**
 * Universal Add to Cart with Idempotency Guard
 * @param {Object} product - Product object
 */
let addToCartInProgress = false;
function addToCart(product) {
    if (addToCartInProgress) return;

    if (!isLoggedIn()) {
        showAuthModal("add products to your cart");
        return;
    }

    if (!product || !product._id) return;

    addToCartInProgress = true;
    setTimeout(() => { addToCartInProgress = false; }, 1000); // 1s cooldown

    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find(item => item.productId === product._id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            productId: product._id,
            quantity: 1,
            price: product.price,
            name: product.name,
            image: product.image
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));

    // Sync with backend
    apiFetch('/cart/merge', {
        method: 'POST',
        body: JSON.stringify({ localCart: cart })
    }).catch(err => console.error('Cart sync failed:', err));

    updateCartBadge();
    showToast('Added to cart!');
}

/**
 * Universal Toggle Wishlist
 * @param {string} productId - Product ID
 */
function toggleWishlist(productId) {
    if (!isLoggedIn()) {
        showAuthModal("save items to your wishlist");
        return;
    }

    let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const index = wishlist.indexOf(productId);

    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist');
    } else {
        wishlist.push(productId);
        showToast('Added to wishlist');
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistBadge();
}

/**
 * Recently Viewed Persistence
 */
function saveToRecentlyViewed(productId) {
    if (!productId) return;
    let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    recentlyViewed = recentlyViewed.filter(id => id !== productId);
    recentlyViewed.unshift(productId);
    recentlyViewed = recentlyViewed.slice(0, 10); // Limit to 10
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
}

// Lazy load images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// Smooth scroll
function smoothScroll(target) {
    document.querySelector(target)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Update Navbar Dropdown state based on authentication
 */
function updateDropdownState() {
    const authLinks = document.getElementById('authLinks');
    const userLinks = document.getElementById('userLinks');

    if (isLoggedIn()) {
        if (authLinks) authLinks.style.display = 'none';
        if (userLinks) userLinks.style.display = 'block';
        updateUserUI();
    } else {
        if (authLinks) authLinks.style.display = 'block';
        if (userLinks) userLinks.style.display = 'none';
    }
}

/**
 * Centralized User UI update (Profile Dropdown)
 */
function updateUserUI() {
    const dropdownMenu = document.getElementById("dropdownMenu");
    const token = localStorage.getItem("token");
    if (!token || !dropdownMenu) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const email = payload.email;

        // Populate email display
        const emailDisplay = document.getElementById('userEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = email;

        const savedAvatar = localStorage.getItem("avatar") || avatars[0];
        const avatarDisplay = document.getElementById('avatarDisplay');
        if (avatarDisplay) avatarDisplay.textContent = savedAvatar;

        // Setup avatar selection logic
        const avatarGrid = document.querySelector('.avatar-grid');
        if (avatarGrid) {
            avatarGrid.innerHTML = avatars.map(a =>
                `<button class="avatar-option p-2 hover:bg-slate-100 rounded-lg transition-all transform hover:scale-110">${a}</button>`
            ).join("");

            document.querySelectorAll(".avatar-option").forEach(btn => {
                btn.addEventListener("click", () => {
                    localStorage.setItem("avatar", btn.innerText);
                    if (avatarDisplay) avatarDisplay.textContent = btn.innerText;
                });
            });
        }
    } catch (e) {
        console.error("Invalid token or UI update error:", e);
    }
}


/**
 * Advanced Global Search System
 */

// Debounce helper for search input
if (typeof debounce !== 'function') {
    function debounce(callback, delay = 300) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => callback(...args), delay);
        };
    }
}

// Store search history
function updateRecentSearches(query) {
    if (!query || query.length < 2) return;
    let searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());
    searches.unshift(query);
    localStorage.setItem('recentSearches', JSON.stringify(searches.slice(0, 5)));
}

// Fetch search suggestions
async function fetchSearchSuggestions(query) {
    if (!query || query.length < 2) return [];
    try {
        const response = await apiFetch(`/products?search=${encodeURIComponent(query)}`);
        // We only need top 5 for suggestions
        return response.products ? response.products.slice(0, 5) : [];
    } catch (err) {
        console.error("Suggestion fetch error:", err);
        return [];
    }
}

// Global search execution
function executeGlobalSearch(query) {
    const trimmedQuery = query.trim().substring(0, 50);
    if (!trimmedQuery) return;

    updateRecentSearches(trimmedQuery);

    // Redirect to products page with search param
    window.location.href = `products.html?search=${encodeURIComponent(trimmedQuery)}`;
}

// Initialize Search UI for all pages
function initGlobalSearch() {
    const searchInputs = [
        document.getElementById('searchInput'),
        document.getElementById('mobileSearchInput'),
        document.getElementById('productSearchInput')
    ].filter(el => el !== null);

    searchInputs.forEach(input => {
        // Create suggestions container if not exists
        let suggestionsBox = input.parentElement.querySelector('.search-suggestions');
        if (!suggestionsBox) {
            suggestionsBox = document.createElement('div');
            suggestionsBox.className = 'search-suggestions custom-scrollbar';
            input.parentElement.appendChild(suggestionsBox);
        }

        // Handle typing (Debounced)
        const showSuggestions = debounce(async (e) => {
            const query = e.target.value;
            if (query.length < 2) {
                suggestionsBox.classList.remove('show');
                return;
            }

            const products = await fetchSearchSuggestions(query);
            if (products.length === 0) {
                suggestionsBox.innerHTML = `
                    <div class="p-4 text-center text-slate-400 text-sm">
                        No products found
                    </div>
                `;
                suggestionsBox.classList.add('show');
                return;
            }

            suggestionsBox.innerHTML = products.map(p => `
                <div class="suggestion-item flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors" onclick="window.location.href='product.html?id=${p._id}'">
                    <img src="${formatImageUrl(p.image)}" alt="${p.name}" class="w-10 h-10 object-contain rounded bg-white">
                    <div class="flex-1 overflow-hidden">
                        <div class="text-sm font-bold text-slate-700 truncate">${p.name}</div>
                        <div class="text-[10px] text-slate-400 uppercase tracking-wider">${p.category}</div>
                    </div>
                    <div class="text-sm font-black text-amber-500">₹${p.price}</div>
                </div>
            `).join('');
            suggestionsBox.classList.add('show');
        }, 300);

        input.addEventListener('input', showSuggestions);

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                executeGlobalSearch(input.value);
            }
        });

        // Hide suggestions on blur
        input.addEventListener('blur', () => {
            setTimeout(() => suggestionsBox.classList.remove('show'), 200);
        });

        // Show recent searches on focus if empty
        input.addEventListener('focus', () => {
            if (!input.value) {
                const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                if (searches.length > 0) {
                    suggestionsBox.innerHTML = `
                        <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-50">Recent Searches</div>
                        ${searches.map(s => `
                            <div class="suggestion-item flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors" onclick="const inputEl = document.getElementById('${input.id}'); inputEl.value='${s}'; executeGlobalSearch('${s}')">
                                <i class="fas fa-history text-slate-300 w-4 text-center"></i>
                                <span class="text-sm text-slate-600 font-medium">${s}</span>
                            </div>
                        `).join('')}
                    `;
                    suggestionsBox.classList.add('show');
                }
            }
        });
    });
}

// Initialize common features
document.addEventListener('DOMContentLoaded', function () {
    // Update Dropdown state based on auth
    // Initial dropdown state update
    updateDropdownState();
    // Small delay to ensure all DOM elements are rendered (useful for dynamic navbars)
    setTimeout(updateDropdownState, 500);

    // Initialize badges
    updateCartBadge();
    updateWishlistBadge();

    // Initialize Advanced Search
    initGlobalSearch();

    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // User dropdown toggle (Hover + Click)
    const userDropdown = document.getElementById('userDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (userDropdown && dropdownMenu) {
        const authLinks = document.getElementById('authLinks');
        const userLinks = document.getElementById('userLinks');
        const logoutBtn = document.getElementById('logoutBtn');

        // Update dropdown based on auth state
        // Initialize dropdown
        updateDropdownState();
        setTimeout(updateDropdownState, 500);

        // Hover logic
        let timeout;
        userDropdown.addEventListener('mouseenter', () => {
            clearTimeout(timeout);
            dropdownMenu.classList.add('show');
        });

        userDropdown.addEventListener('mouseleave', () => {
            timeout = setTimeout(() => {
                dropdownMenu.classList.remove('show');
            }, 300); // Small delay to prevent flickering
        });

        // Click logic for mobile/toggle
        userDropdown.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', function () {
            dropdownMenu.classList.remove('show');
        });

        // Logout logic
        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('userEmail');
            showToast('Logged out successfully');
            setTimeout(() => window.location.reload(), 1000);
        });
    }

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('show');
        });
    }

    // Live time in footer
    const liveTimeElement = document.getElementById('liveTime');
    if (liveTimeElement) {
        function updateTime() {
            const now = new Date();
            liveTimeElement.textContent = now.toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'medium'
            });
        }
        updateTime();
        setInterval(updateTime, 1000);
    }

    // Lazy load images
    lazyLoadImages();
});
