/* =========================================================
   MAIN JAVASCRIPT – HOMEPAGE
   ========================================================= */

/* ---------------- GLOBAL STATE ---------------- */

let allProducts = [];
let filteredProducts = [];
let currentSlide = 0;
let heroInterval;

/* ---------------- CONSTANTS ---------------- */

const HERO_SLIDE_INTERVAL = 3000;
const RECENTLY_VIEWED_LIMIT = 8;

/* ---------------- UTILITIES ---------------- */

/**
 * Simple debounce helper
 * Prevents excessive function calls (search input)
 */
function debounce(callback, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(...args), delay);
    };
}

/* =========================================================
   PRODUCT LOADING
   ========================================================= */

/**
 * Load product data from MongoDB
 */
async function loadProducts() {
    try {
        const response = await apiFetch('/products');
        allProducts = response.products || []; // Extract from nested products array
        filteredProducts = [...allProducts];

        displayBestSellers();
        displayAllProducts();
        loadRecentlyViewed();
        hideLoader();
    } catch (error) {
        console.error('Failed to load products:', error);
        hideLoader();
        showToast('Error loading products', 'error');
    }
}

/* =========================================================
   LOADER
   ========================================================= */

/**
 * Hide page loader safely
 */
function hideLoader() {
    const loader = document.getElementById('pageLoader');

    if (!loader) return;

    loader.classList.add('hide');

    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);
}

/* =========================================================
   HERO SLIDER
   ========================================================= */

/**
 * Initialize hero slider
 */
function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');

    if (!slides.length) return;

    function nextSlide() {
        slides[currentSlide].classList.remove('active');

        currentSlide = (currentSlide + 1) % slides.length;

        slides[currentSlide].classList.add('active');
    }

    heroInterval = setInterval(nextSlide, HERO_SLIDE_INTERVAL);
}

/* =========================================================
   PRODUCT RENDERING
   ========================================================= */

/**
 * Display Best Sellers
 */
function displayBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    // Filter bestsellers FROM the currently filtered products
    const bestsellers = filteredProducts
        .filter(p => p.bestseller)
        .slice(0, 4);

    grid.innerHTML = bestsellers
        .map((product, index) => createProductCard(product, index))
        .join('');
}

/**
 * Display All Products
 */
function displayAllProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    // Show only 4 products on the home page as requested
    grid.innerHTML = filteredProducts
        .slice(0, 4)
        .map((product, index) => createProductCard(product, index))
        .join('');
}

/**
 * Create Product Card HTML
 * (Logic unchanged)
 */
function createProductCard(product, index) {
    const productId = product._id;
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const isWishlisted = wishlist.includes(productId);

    // Dynamic defaults for professional feel
    const price = product.price || 0;
    const originalPrice = product.originalPrice || Math.round(price * 1.5);
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
    const rating = product.rating || 4.5;
    const reviews = product.reviews || Math.floor(Math.random() * 500) + 50;
    const soldCount = product.soldCount || Math.floor(Math.random() * 100) + 10;

    return `
        <div class="product-card cursor-pointer group"
             onclick="window.location.href='product.html?id=${productId}'"
             style="animation-delay: ${index * 0.1}s"
             data-testid="product-card-${productId}">

            <div class="relative overflow-hidden">
                <img src="${formatImageUrl(product.image)}"
                     alt="${product.name}"
                     class="product-image group-hover:scale-110 transition-transform duration-500"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300?text=No+Image'">

                <button onclick="event.stopPropagation(); toggleWishlist('${productId}')"
                        class="wishlist-btn ${isWishlisted ? 'active' : ''}">
                    <i class="fas fa-heart"></i>
                </button>

                ${product.bestseller || product.soldCount > 50
            ? '<div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">Best Seller</div>'
            : ''
        }
            </div>

            <div class="p-4">
                <h3 class="product-title group-hover:text-amber-500 transition-colors">${product.name}</h3>

                <div class="flex items-center gap-2 mb-2">
                    <span class="rating-box">${rating} ★</span>
                    <span class="text-xs text-slate-500">
                        (${reviews})
                    </span>
                </div>

                <div class="flex items-center gap-2 mb-2">
                    <span class="product-price">₹${price}</span>
                    <span class="original-price">₹${originalPrice}</span>
                    <span class="discount-text">${discount}% off</span>
                </div>

                <p class="stock-alert">
                    <i class="fas fa-bolt"></i> ${product.stock < 10 ? 'Only few left' : 'In Stock'}
                </p>

                <p class="text-xs text-orange-600 mb-3">
                    <i class="fas fa-fire"></i>
                    ${soldCount}+ bought last month
                </p>

                <div class="flex items-center justify-between">
                    <button onclick="event.stopPropagation(); addToCartById('${productId}')"
                            class="add-to-cart-btn">
                        <i class="fas fa-shopping-cart mr-1"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Helper to bridge to universal addToCart
function addToCartById(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (product) {
        addToCart(product);
    } else {
        console.error('Product not found for ID:', productId);
    }
}

/* =========================================================
   RECENTLY VIEWED
   ========================================================= */

function saveToRecentlyViewed(productId) {

    let recentlyViewed = JSON.parse(
        localStorage.getItem('recentlyViewed') || '[]'
    );

    recentlyViewed = recentlyViewed.filter(id => id !== productId);
    recentlyViewed.unshift(productId);

    recentlyViewed = recentlyViewed.slice(0, RECENTLY_VIEWED_LIMIT);

    localStorage.setItem(
        'recentlyViewed',
        JSON.stringify(recentlyViewed)
    );

    loadRecentlyViewed();
}

function loadRecentlyViewed() {

    const recentlyViewed = JSON.parse(
        localStorage.getItem('recentlyViewed') || '[]'
    );

    const section = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');

    if (!section || !grid) return;

    if (!recentlyViewed.length) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const products = recentlyViewed
        .map(id => allProducts.find(p => p._id === id))
        .filter(Boolean);

    grid.innerHTML = products.map(product => `
        <div class="min-w-[250px] product-card">
            <div class="relative">
                <img src="${product.image}"
                     alt="${product.name}"
                     class="product-image"
                     loading="lazy">
            </div>

            <div class="p-4">
                <h3 class="product-title">${product.name}</h3>

                <div class="flex items-center justify-between mt-3">
                    <span class="product-price">₹${product.price}</span>

                    <button onclick="addToCart('${product._id}')"
                            class="add-to-cart-btn">
                        <i class="fas fa-shopping-cart mr-1"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/* =========================================================
   FILTERS
   ========================================================= */

function setupCategoryFilter() {
    const pills = document.querySelectorAll('.category-pill');
    if (!pills.length) return;

    pills.forEach(pill => {
        pill.addEventListener('click', function () {
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');

            const selectedCategory = this.dataset.category.toLowerCase();

            if (selectedCategory === 'all') {
                filteredProducts = [...allProducts];
            } else if (selectedCategory === 'others') {
                // Handle "others" - anything that doesn't match specific predefined categories
                const definedCategories = ['iphone', 'samsung', 'buds', 'templates'];
                filteredProducts = allProducts.filter(p => {
                    const productCat = (p.category || '').toLowerCase();
                    return !definedCategories.includes(productCat);
                });
            } else {
                filteredProducts = allProducts.filter(p =>
                    (p.category || '').toLowerCase() === selectedCategory
                );
            }

            displayAllProducts();
            displayBestSellers(); // Also update best sellers
        });
    });
}

/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

    const searchInputs = document.querySelectorAll(
        '#searchInput, #mobileSearchInput'
    );

    if (!searchInputs.length) return;

    searchInputs.forEach(input => {
        input.addEventListener('input',
            debounce(function (e) {

                const query = e.target.value.toLowerCase();

                if (!query.length) {
                    filteredProducts = [...allProducts];
                } else {
                    filteredProducts = allProducts.filter(p =>
                        p.name.toLowerCase().includes(query)
                    );
                }

                displayAllProducts();
                displayBestSellers(); // Also update best sellers
            })
        );
    });
}

/* =========================================================
   COUNTDOWN
   ========================================================= */

function initCountdown() {

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3);

    function updateCountdown() {

        const now = new Date();
        const diff = endDate - now;

        if (diff <= 0) return;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
    initHeroSlider();
    setupCategoryFilter();
    initCountdown();
    setupSearch();
    loadProducts();
});
