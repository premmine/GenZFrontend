// Products Page JavaScript

let allProducts = [];
let filteredProducts = [];

// Load products from MongoDB
async function loadProducts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');

        let endpoint = '/products';
        if (searchQuery) {
            endpoint += `?search=${encodeURIComponent(searchQuery)}`;
            // Update search input value to match query
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput) searchInput.value = searchQuery;

            // Show searching toast
            showToast(`Searching for "${searchQuery}"...`);
        }

        const response = await apiFetch(endpoint);
        allProducts = response.products || response; // Support both old and new API format
        filteredProducts = [...allProducts];

        displayProducts();

        // After loading products, if search was performed, show results count
        if (searchQuery) {
            const grid = document.getElementById('productsGrid');
            const resultCount = response.count !== undefined ? response.count : allProducts.length;

            // Update UI with search stats
            const statsDiv = document.createElement('div');
            statsDiv.className = 'col-span-full mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3 animate-in slide-in-from-top duration-500';
            statsDiv.innerHTML = `
                <div class="bg-amber-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg">
                    <i class="fas fa-search"></i>
                </div>
                <div>
                    <span class="font-black text-slate-800">${resultCount}</span> 
                    <span class="text-slate-600 font-medium">results found for</span> 
                    <span class="font-black text-amber-600">"${searchQuery}"</span>
                </div>
                <button onclick="window.location.href='products.html'" class="ml-auto text-xs font-bold text-amber-600 hover:text-amber-700 underline">Clear Search</button>
            `;
            grid.prepend(statsDiv);

            // Auto-redirect if only one product found
            if (resultCount === 1) {
                setTimeout(() => {
                    const p = allProducts[0];
                    showToast(`Redirecting to ${p.name}...`);
                    window.location.href = `product.html?id=${p._id}`;
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Failed to load products', 'error');
    }
}

// Display Products
function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center animate-in fade-in duration-700">
                <div class="mb-6 inline-flex items-center justify-center w-24 h-24 bg-slate-100 rounded-full text-slate-300">
                    <i class="fas fa-search-minus text-4xl"></i>
                </div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">No products found</h3>
                <p class="text-slate-500 mb-8 max-w-xs mx-auto">We couldn't find any items matching your search. Try different keywords or browse our categories.</p>
                <div class="flex gap-4 justify-center">
                    <button onclick="window.location.href='products.html'" class="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20">Clear Search</button>
                    <button onclick="window.location.href='index.html'" class="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">Go to Home</button>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredProducts
        .map((product, index) => createProductCard(product, index))
        .join('');
}

// Create Product Card
function createProductCard(product, index) {
    const productId = product._id;
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const isWishlisted = wishlist.includes(productId);

    // Dynamic defaults for consistency
    const price = product.price || 0;
    const originalPrice = product.originalPrice || Math.round(price * 1.5);
    const rating = product.rating || 4.5;
    const reviews = product.reviews || Math.floor(Math.random() * 500) + 50;

    return `
        <div class="product-card cursor-pointer group" 
             onclick="window.location.href='product.html?id=${productId}'"
             style="animation-delay: ${index * 0.1}s">
            <div class="relative overflow-hidden">
                <img src="${formatImageUrl(product.image)}" 
                     alt="${product.name}" 
                     class="product-image group-hover:scale-110 transition-transform duration-500" 
                     loading="lazy">
                
                <button onclick="event.stopPropagation(); toggleWishlist('${productId}')" 
                        class="wishlist-btn ${isWishlisted ? 'active' : ''}">
                    <i class="fas fa-heart"></i>
                </button>
                
                ${product.bestseller || (product.soldCount > 50)
            ? '<div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">Best Seller</div>'
            : ''}
            </div>
            <div class="p-4">
                <h3 class="product-title group-hover:text-amber-500 transition-colors">${product.name}</h3>
                <div class="flex items-center gap-2 mb-2">
                    <div class="flex text-yellow-400 text-sm">
                        ${'⭐'.repeat(Math.round(rating))}
                    </div>
                    <span class="text-xs text-slate-500">(${reviews} reviews)</span>
                </div>
                <p class="text-xs text-orange-600 mb-3">
                    <i class="fas fa-fire"></i> ${product.soldCount || 10}+ bought last month
                </p>
                <div class="flex items-center justify-between">
                    <span class="product-price">₹${price}</span>
                    <button onclick="event.stopPropagation(); addToCartById('${productId}')" class="add-to-cart-btn">
                        <i class="fas fa-shopping-cart mr-1"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Bridge to universal helpers
function addToCartById(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (product) addToCart(product);
}

function updateWishlist(productId) {
    toggleWishlist(productId);
    displayProducts(); // Refresh UI
}

// Category Filter
function setupCategoryFilter() {
    const pills = document.querySelectorAll('.category-pill');

    pills.forEach(pill => {
        pill.addEventListener('click', function () {
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');

            const selectedCategory = this.dataset.category.toLowerCase();

            if (selectedCategory === 'all') {
                filteredProducts = [...allProducts];
            } else if (selectedCategory === 'others') {
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

            displayProducts();
        });
    });
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('productSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce(function (e) {
        const query = e.target.value.toLowerCase();

        if (query.length === 0) {
            filteredProducts = [...allProducts];
        } else {
            filteredProducts = allProducts.filter(p =>
                p.name.toLowerCase().includes(query)
            );
        }

        displayProducts();
    }, 300));
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    setupCategoryFilter();
    setupSearch();
    loadProducts();
});


