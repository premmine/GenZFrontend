/* =========================================================
   SERVICES PAGE LOGIC
   ========================================================= */

var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

/**
 * Page-specific logic for Services.
 * Note: Common features like Navbar auth, Cart counts, and Live time
 * are handled by the centralized js/utils.js script.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Smooth Scroll for "Learn More" and internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || !href.startsWith('#')) return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 2. Add scroll revealed animations if needed
    const revealOnScroll = () => {
        const elements = document.querySelectorAll('.service-card, .step-node');
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight - 100;
            if (isVisible) {
                el.classList.add('opacity-100', 'translate-y-0');
                el.classList.remove('opacity-0', 'translate-y-10');
            }
        });
    };

    // Initialize with hidden state for cards if we want reveal effects
    const cards = document.querySelectorAll('.service-card, .step-node');
    cards.forEach(card => {
        card.classList.add('transition-all', 'duration-700', 'opacity-0', 'translate-y-10');
    });

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger once on load
});
