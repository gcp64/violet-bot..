// ===========================
// Violet Shop - Frontend Script
// ===========================

// Backend API URL (Express server)
const API_URL = 'http://localhost:3000/api/order';

let selectedPackage = '';
let selectedPrice = '';

// --- Particles Background ---
(function createParticles() {
    const container = document.getElementById('particles');
    const count = 25;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 6 + 3;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (Math.random() * 20 + 15) + 's';
        p.style.animationDelay = (Math.random() * 15) + 's';
        if (Math.random() > 0.5) {
            p.style.background = '#EB459E';
        }
        container.appendChild(p);
    }
})();

// --- Modal Functions ---
function openOrderModal(packageName, price) {
    selectedPackage = packageName;
    selectedPrice = price;
    document.getElementById('modalPackageInfo').textContent = `الباقة: ${packageName} — السعر: ${price}`;
    document.getElementById('discordUsername').value = '';
    document.getElementById('modalStatus').textContent = '';
    document.getElementById('modalStatus').className = 'modal-status';
    toggleSubmitLoading(false);
    document.getElementById('orderModal').classList.add('active');
}

function closeModal() {
    document.getElementById('orderModal').classList.remove('active');
}

// Close modal on outside click
document.getElementById('orderModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
});

function toggleSubmitLoading(loading) {
    const btn = document.getElementById('submitOrder');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoader.style.display = loading ? 'inline-flex' : 'none';
}

// --- Submit Order to Backend ---
async function submitOrder() {
    const username = document.getElementById('discordUsername').value.trim();
    const status = document.getElementById('modalStatus');

    if (!username) {
        status.textContent = '⚠️ يرجى إدخال اسم المستخدم الخاص بك!';
        status.className = 'modal-status error';
        return;
    }

    toggleSubmitLoading(true);
    status.textContent = '';
    status.className = 'modal-status';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                packageName: selectedPackage,
                price: selectedPrice,
                buyerUsername: username,
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            status.textContent = '✅ تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً.';
            status.className = 'modal-status success';
            setTimeout(() => closeModal(), 3000);
        } else {
            status.textContent = data.message || '❌ حدث خطأ أثناء الإرسال. حاول مرة أخرى.';
            status.className = 'modal-status error';
        }
    } catch (error) {
        console.error('Network error:', error);
        status.textContent = '❌ خطأ في الاتصال. تأكد من أن السيرفر يعمل.';
        status.className = 'modal-status error';
    } finally {
        toggleSubmitLoading(false);
    }
}
