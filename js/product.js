/* =========================================================
   PRODUCT DETAILS JAVASCRIPT
   ========================================================= */

var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize UI components
    let currentRating = 0;
    const ratingSelector = document.getElementById('ratingSelector');
    if (ratingSelector) {
        ratingSelector.querySelectorAll('i').forEach(star => {
            star.addEventListener('click', () => {
                currentRating = parseInt(star.dataset.value);
                updateRatingUI(currentRating);
            });
            star.addEventListener('mouseenter', () => updateRatingUI(parseInt(star.dataset.value)));
            star.addEventListener('mouseleave', () => updateRatingUI(currentRating));
        });
    }

    function updateRatingUI(rating) {
        ratingSelector.querySelectorAll('i').forEach((star, index) => {
            if (index < rating) {
                star.classList.add('text-amber-400');
                star.classList.remove('text-slate-200');
            } else {
                star.classList.remove('text-amber-400');
                star.classList.add('text-slate-200');
            }
        });
    }

    try {
        const product = await apiFetch(`/products/${productId}`);
        renderProductDetails(product);
        loadProductReviews(productId);
        saveToRecentlyViewed(productId);
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Product not found', 'error');
        setTimeout(() => window.location.href = 'products.html', 2000);
    }

    // Tab switching
    window.switchTab = (tabId, element) => {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        if (element) {
            element.classList.add('active');
        } else if (window.event) {
            window.event.currentTarget.classList.add('active');
        }
    };

    // Review modal
    window.openReviewModal = () => {
        if (!isLoggedIn()) {
            showAuthModal('post a review');
            return;
        }
        document.getElementById('reviewModal').classList.remove('hidden');
        document.getElementById('reviewModal').classList.add('flex');
    };

    window.closeReviewModal = () => {
        document.getElementById('reviewModal').classList.add('hidden');
        document.getElementById('reviewModal').classList.remove('flex');
    };

    // Review Submission
    document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentRating === 0) {
            showToast('Please select a rating', 'error');
            return;
        }

        const comment = document.getElementById('reviewComment').value.trim();
        const area = document.getElementById('reviewArea')?.value.trim() || '';
        const state = document.getElementById('reviewState')?.value.trim() || '';

        if (!comment) {
            showToast('Please add a comment', 'error');
            return;
        }

        try {
            await apiFetch(`/reviews/${productId}`, {
                method: 'POST',
                body: JSON.stringify({
                    rating: currentRating,
                    comment: comment,
                    area: area,
                    state: state
                })
            });
            showToast('Review submitted successfully!');
            closeReviewModal();
            loadProductReviews(productId);
        } catch (error) {
            showToast(error.message || 'Failed to post review', 'error');
        }
    });
});

function renderProductDetails(product) {
    // Breadcrumbs
    document.getElementById('breadcrumbCategory').textContent = product.category;
    document.getElementById('breadcrumbName').textContent = product.name;

    // Basic Info
    document.getElementById('productName').textContent = product.name;
    document.title = `${product.name} | GenziKart.in`;

    const price = product.price || 0;
    const originalPrice = product.originalPrice || Math.round(price * 1.5);
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

    document.getElementById('productPrice').textContent = formatCurrency(price);
    document.getElementById('originalPrice').textContent = formatCurrency(originalPrice);
    document.getElementById('discountBadge').textContent = `${discount}% off`;
    document.getElementById('stockCount').textContent = product.stock;

    if (product.stock <= 0) {
        document.getElementById('stockStatus').classList.add('bg-gray-100', 'text-gray-500');
        document.getElementById('stockStatus').innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
        document.getElementById('buyNowBtn').disabled = true;
        document.getElementById('buyNowBtn').classList.add('opacity-50', 'cursor-not-allowed');
    }

    // Gallery - Filter out potentially broken or invalid URLs
    const images = [product.image, ...(product.gallery || [])]
        .map(img => formatImageUrl(img))
        .filter(img => img && img.startsWith('http'));

    const thumbContainer = document.getElementById('galleryThumbnails');
    const mainImg = document.getElementById('mainImage');

    // Fallback for main image if it fails
    mainImg.src = formatImageUrl(product.image);

    thumbContainer.innerHTML = images.map((img, i) => `
        <div class="gallery-thumbnail w-16 h-16 md:w-20 md:h-20 bg-white border border-slate-200 rounded-lg p-1 cursor-pointer transition-all flex-shrink-0 flex items-center justify-center ${i === 0 ? 'active' : ''}" 
             onclick="updateGallery('${img}', this)">
            <img src="${img}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.style.display='none'">
        </div>
    `).join('');

    window.updateGallery = (imgUrl, el) => {
        mainImg.src = imgUrl;
        document.querySelectorAll('.gallery-thumbnail').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
    };

    // Highlights
    const highlights = product.highlights && product.highlights.length > 0
        ? product.highlights
        : ["1 Year Manufacturer Warranty", "7 Days Replacement Policy", "Cash on Delivery Available", "Fast Shipping"];

    document.getElementById('highlightsList').innerHTML = highlights.map(h => `
        <li class="flex items-start gap-3">
            <i class="fas fa-check-circle text-green-500 mt-0.5"></i>
            <span>${h}</span>
        </li>
    `).join('');

    // Description
    document.getElementById('productDescription').textContent = product.description || "No detailed description available for this product.";

    // Specs
    const specs = product.specifications && product.specifications.length > 0
        ? product.specifications
        : [
            { label: "Category", value: product.category },
            { label: "Availability", value: product.status || "In Stock" },
            { label: "Generic Name", value: "Electronics" },
            { label: "Seller", value: "GenziKart Retail" }
        ];

    document.getElementById('specsTable').innerHTML = specs.map(s => `
        <div class="flex border-b border-slate-50 pb-2">
            <span class="w-1/3 text-slate-400 text-sm font-medium">${s.label}</span>
            <span class="w-2/3 text-slate-700 text-sm font-semibold">${s.value}</span>
        </div>
    `).join('');

    // Cart Logic Integration - Use .onclick to ensure NO duplicate listeners
    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
        addToCartBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            addToCart(product);
        };
    }

    const buyNowBtn = document.getElementById('buyNowBtn');
    if (buyNowBtn) {
        buyNowBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            addToCart(product);
            setTimeout(() => window.location.href = 'cart.html', 500);
        };
    }
}

let swiper;

async function loadProductReviews(productId) {
    try {
        const reviews = await apiFetch(`/reviews/${productId}`);
        const list = document.getElementById('reviewsList');

        if (reviews.length === 0) {
            list.innerHTML = `
                <div class="swiper-slide h-auto">
                    <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p class="text-slate-500">No reviews yet. Be the first to share your thoughts!</p>
                    </div>
                </div>
            `;
            return;
        }

        const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        document.getElementById('avgRatingBig').textContent = avg.toFixed(1);
        document.getElementById('reviewCountBig').textContent = reviews.length;

        // Render Stars
        let starsHtml = '';
        const roundedAvg = Math.round(avg);
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="fas fa-star ${i <= roundedAvg ? 'text-amber-400' : 'text-slate-200'}"></i>`;
        }
        document.getElementById('starRating').innerHTML = starsHtml;

        list.innerHTML = reviews.map(r => `
            <div class="swiper-slide h-auto">
                <div class="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col h-full items-center text-center group">
                    <div class="relative mb-6">
                        <div class="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-50 group-hover:border-amber-100 transition-all p-1 bg-white">
                            <img src="${r.avatar}" alt="${r.name}" class="w-full h-full object-cover rounded-full">
                        </div>
                        <div class="absolute -bottom-1 -right-1 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white text-[10px]">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                    
                    <h4 class="font-bold text-slate-800 mb-1">${r.name}</h4>
                    <div class="flex text-amber-400 text-xs mb-3">
                        ${Array(5).fill(0).map((_, i) => `<i class="${i < r.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                    </div>
                    
                    <p class="text-slate-600 text-sm leading-relaxed italic line-clamp-4 flex-1">
                        "${r.comment}"
                    </p>
                    
                    <div class="mt-4 pt-4 border-t border-slate-50 w-full flex flex-col items-center justify-center gap-1 text-slate-400">
                        <span class="text-[10px] font-bold uppercase tracking-widest">${r.date || 'Recent'}</span>
                        ${r.area || r.state ? `<span class="text-[9px] font-semibold text-slate-400 capitalize">${[r.area, r.state].filter(Boolean).join(', ')}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Initialize/Update Swiper
        if (swiper) swiper.destroy();
        swiper = new Swiper(".reviewSwiper", {
            slidesPerView: 1,
            spaceBetween: 20,
            loop: reviews.length > 3,
            autoplay: {
                delay: 4000,
                disableOnInteraction: false,
            },
            pagination: {
                el: ".swiper-pagination",
                clickable: true,
            },
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
            breakpoints: {
                640: {
                    slidesPerView: 1,
                },
                768: {
                    slidesPerView: 2,
                },
                1024: {
                    slidesPerView: 3,
                },
            },
        });

    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}
