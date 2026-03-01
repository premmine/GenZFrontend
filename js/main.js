/* =========================================================
   MAIN JAVASCRIPT – HOMEPAGE
   ========================================================= */

var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

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
        .map((product, index) => renderProductCard(product, index))
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
        .map((product, index) => renderProductCard(product, index))
        .join('');
}

/**
 * Create Product Card HTML
 * (Logic unchanged)
 */
function renderProductCard(product, index) {
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
                     loading="lazy">

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

// Redundant saveToRecentlyViewed removed (using utils.js version)

function loadRecentlyViewed() {
    const recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const section = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');

    if (!section || !grid) return;

    if (!recentlyViewed.length) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    // Get the product objects from the stored IDs
    const products = recentlyViewed
        .map(id => allProducts.find(p => (p._id || p.id) === id))
        .filter(Boolean)
        .slice(0, 4);

    if (products.length === 0) {
        section.classList.add('hidden');
        return;
    }

    // Render compact horizontal cards
    grid.innerHTML = products.map((product) => {
        const productId = product._id || product.id;
        const price = product.price || 0;
        const originalPrice = product.originalPrice || Math.round(price * 1.5);
        const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        const isWishlisted = wishlist.includes(productId);

        return `
        <div class="rv-card flex-shrink-0" onclick="window.location.href='product.html?id=${productId}'" style="cursor:pointer">
            <div class="rv-card-img-wrap">
                <img src="${formatImageUrl(product.image)}" alt="${product.name}" class="rv-card-img" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/180x160?text=No+Image'">
                <button class="rv-wish-btn ${isWishlisted ? 'active' : ''}"
                        onclick="event.stopPropagation(); toggleWishlist('${productId}'); this.classList.toggle('active')">
                    <i class="fas fa-heart"></i>
                </button>
                ${discount > 0 ? `<span class="rv-badge">${discount}% off</span>` : ''}
            </div>
            <div class="rv-card-body">
                <p class="rv-name">${product.name}</p>
                <div class="rv-pricing">
                    <span class="rv-price">₹${price.toLocaleString('en-IN')}</span>
                    <span class="rv-orig">₹${originalPrice.toLocaleString('en-IN')}</span>
                </div>
                <button class="rv-cart-btn" onclick="event.stopPropagation(); addToCartById('${productId}')">
                    <i class="fas fa-shopping-cart"></i> Add
                </button>
            </div>
        </div>`;
    }).join('');
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
   OFFER SHOWCASE & COUNTDOWN
   ========================================================= */

let showcaseInterval;

async function initOfferShowcase() {
    const showcase = document.getElementById('offerShowcase');
    const grid = document.getElementById('videoShowcaseGrid');
    if (!showcase || !grid) return;

    try {
        const offers = await apiFetch('/offer-videos/active');
        if (!offers || offers.length === 0) {
            showcase.classList.add('hidden');
            return;
        }

        showcase.classList.remove('hidden');
        renderShowcaseVideos(offers);

        // Start countdown using the first offer's expiry (assuming they match, or just use the earliest)
        const earliestExpiry = new Date(Math.min(...offers.map(o => new Date(o.expiryDate))));
        startShowcaseCountdown(earliestExpiry);

    } catch (err) {
        console.warn('Failed to load offer showcase', err);
        showcase.classList.add('hidden');
    }
}

function renderShowcaseVideos(offers) {
    const grid = document.getElementById('videoShowcaseGrid');
    if (!grid) return;

    grid.innerHTML = offers.map(offer => {
        const product = offer.productId || {};
        const productUrl = `product.html?id=${product._id}`;
        const rating = product.rating || 5;

        // Use the centralized video player renderer
        const mediaHtml = typeof renderVideoPlayer === 'function'
            ? renderVideoPlayer(offer.videoUrl, "showcase-video w-full h-full")
            : `<div class="w-full h-full flex items-center justify-center bg-gray-900"><i class="fas fa-play text-4xl text-gray-700"></i></div>`;

        return `
            <div class="video-card">
                <div class="video-container">
                    ${mediaHtml}
                    <div class="video-overlay-content">
                        <div class="video-info">
                            <h3 class="video-title">${offer.title}</h3>
                            <p class="video-offer">${offer.offerText}</p>
                            <div class="video-rating">
                                <div class="rating-stars">
                                    ${Array(5).fill(0).map((_, i) => `<i class="${i < rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                                </div>
                                <span>${rating} (${(Math.floor(Math.random() * 2000) + 500).toLocaleString()} Reviews)</span>
                            </div>
                        </div>
                        <div class="video-btns">
                            <a href="${productUrl}" class="btn-showcase-buy">Buy Now</a>
                            <a href="${productUrl}" class="btn-showcase-view">View Details</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


function startShowcaseCountdown(endDate) {
    function update() {
        const now = new Date();
        const diff = endDate - now;

        if (diff <= 0) {
            document.getElementById('offerShowcase')?.classList.add('hidden');
            clearInterval(showcaseInterval);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        if (daysEl) daysEl.textContent = String(d).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');
    }

    update();
    showcaseInterval = setInterval(update, 1000);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
    initHeroSlider();
    setupCategoryFilter();
    initOfferShowcase();
    setupSearch();
    loadProducts();
    initFeaturedReviews();
});

/* =========================================================
   FEATURED REVIEWS CAROUSEL
   ========================================================= */

let reviewSlideIndex = 0;
let reviewInterval;

/**
 * Main initializer for featured reviews
 */
async function initFeaturedReviews() {
    const reviews = await fetchFeaturedReviews();
    // renderFeaturedReviews now handles fallbacks internally
    renderFeaturedReviews(reviews);

    // Start carousel if we have enough items (fallback or real)
    const container = document.getElementById('featuredReviewsContainer');
    const items = container ? container.querySelectorAll('.review-card-vertical').length : 0;
    if (items > 1) {
        startReviewCarousel(items);
    }
}

/**
 * Fetch real customer reviews from API for homepage carousel
 */
async function fetchFeaturedReviews() {
    try {
        const reviews = await apiFetch('/reviews/all?limit=8');
        return reviews || [];
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return [];
    }
}

/**
 * Render reviews into the carousel (Stacked Card UI)
 */
function renderFeaturedReviews(reviews) {
    const container = document.getElementById('featuredReviewsContainer');
    if (!container) return;

    // Always show real reviews; no dummy fallback needed
    if (!reviews || reviews.length === 0) return;

    container.innerHTML = reviews.map((review) => {
        const avatarSrc = review.avatar
            ? review.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(review.name || 'User')}&background=fb923c&color=fff`;

        return `
        <div class="showcase-review-slide">
            <img src="${avatarSrc}" class="review-avatar" alt="${review.name || 'Reviewer'}"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(review.name || 'U')}&background=fb923c&color=fff'">
            <div class="review-content">
                <div class="review-header">
                    <span class="review-author text-white">${review.name || 'Customer'}</span>
                    <span class="review-verified"><i class="fas fa-check-circle"></i> Verified Buyer</span>
                </div>
                <div class="rating-stars my-1">
                    ${Array(5).fill(0).map((_, i) => `<i class="${i < review.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                </div>
                <p class="review-text-quote">"${review.comment}"</p>
            </div>
        </div>`;
    }).join('');

    if (reviews.length > 1) startReviewCarousel(reviews.length);
}

function startReviewCarousel(count) {
    if (reviewInterval) clearInterval(reviewInterval);

    reviewInterval = setInterval(() => {
        reviewSlideIndex = (reviewSlideIndex + 1) % count;
        const container = document.getElementById('featuredReviewsContainer');
        if (container) {
            container.style.transform = `translateY(-${reviewSlideIndex * 140}px)`;
        }
    }, 5000);
}
