// 1. OBTENER ID DEL CLIENTE DE LA URL
const urlParams = new URLSearchParams(window.location.search);
const CLIENT_ID = urlParams.get('id') || 'demo'; // 'demo' es tu rifa personal

// 2. CONFIGURACIÓN DINÁMICA
// ⚠️ URL PRODUCCIÓN
const BASE_API = "http://localhost:3000/api";
const BACKEND_URL = `${BASE_API}/${CLIENT_ID}/comprar`;
const CONFIG_URL = `${BASE_API}/${CLIENT_ID}/config`;

// ... (El resto del archivo sigue igual) ...
//const BACKEND_URL = "http://localhost:3000/api/comprar";
//const CONFIG_URL = "http://localhost:3000/api/config";

// Variables Globales
let TICKET_PRICE = 5; 
let CURRENCY = '$';
let quantity = 1;
const MAX_LIMIT = 10000; 

let BANK_NAME = "Mercantil";
let BANK_CODE = "0105";
let PAY_PHONE = "04141234567";
let PAY_CI = "J-123456789";

// Variables del Slider
let sliderImages = [];
let currentSlide = 0;
let slideInterval;

// ==========================================
// 2. ELEMENTOS DEL DOM
// ==========================================
const qtyDisplay = document.getElementById('qty-display');
const totalDisplay = document.getElementById('total-display');
const modalTotal = document.getElementById('modal-total');
const unitPriceDisplay = document.getElementById('unit-price-display'); 
const btnMinus = document.getElementById('btn-minus');
const btnPlus = document.getElementById('btn-plus');
const modal = document.getElementById('checkout-modal');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const backdrop = document.getElementById('modal-backdrop');
const errorModal = document.getElementById('payment-error-modal');

// ==========================================
// 3. CARGAR CONFIGURACIÓN DESDE EL SERVIDOR
// ==========================================

async function loadRaffleConfig() {
    const loader = document.getElementById('app-loader');
    try {
        const response = await fetch(CONFIG_URL);
        const data = await response.json();
        
        // --- 1. BRANDING (LOGO, ICONO, NOMBRE) ---
        
        // A. Nombre de la Empresa (Título de la Pestaña)
        if (data.companyName) {
            document.title = data.companyName;
        }

        // B. Favicon (Icono de la Pestaña)
        if (data.faviconUrl) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'shortcut icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = data.faviconUrl;
        }

        // C. Logo Visual (Header)
        if (data.logoUrl) {
            const logoImg = document.getElementById('custom-logo-img');
            const defaultIcon = document.getElementById('default-logo-icon');
            if (logoImg && defaultIcon) {
                logoImg.src = data.logoUrl;
                logoImg.classList.remove('hidden'); // Mostrar imagen
                defaultIcon.classList.add('hidden'); // Ocultar icono por defecto
            }
        }

        // --- 2. CONFIGURACIÓN DEL SORTEO ---

        // Textos del Sorteo
        const companyText = data.companyName || "Tu Empresa";
        const raffleText = data.raffleTitle || "Gran Rifa";
        const codeText = data.drawCode || "Sorteo General";

        // Header: Muestra Nombre de Empresa
        const headerTitle = document.getElementById('raffle-title-display');
        const headerCode = document.getElementById('draw-code-display');
        if(headerTitle) headerTitle.innerText = companyText; 
        if(headerCode) headerCode.innerText = codeText;

        // Hero: Muestra Nombre de Rifa
        const heroTitle = document.getElementById('hero-title-display');
        const heroCode = document.getElementById('hero-code-display');
        if(heroTitle) heroTitle.innerText = raffleText;
        if(heroCode) heroCode.innerText = codeText;


        // --- 3. ESTADO Y PRECIOS ---

        if (data.isClosed) lockRaffleUI();

        if (data.ticketPrice) {
            TICKET_PRICE = parseFloat(data.ticketPrice);
            CURRENCY = data.currency || '$';
            
            const totalTickets = parseInt(data.totalTickets) || 100;
            const manualSold = parseInt(data.manualSold) || 0;
            updateProgressBar(manualSold, totalTickets);

            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                sliderImages = data.images;
                initSlider(); 
            }
            
            // Datos Bancarios
            if (data.bankName) BANK_NAME = data.bankName;
            if (data.bankCode) BANK_CODE = data.bankCode;
            if (data.paymentPhone) PAY_PHONE = data.paymentPhone;
            if (data.paymentCI) PAY_CI = data.paymentCI;

            // Actualizar textos bancarios
            const bankInfo = document.getElementById('display-bank-info');
            const phoneDisplay = document.getElementById('display-payment-phone');
            const ciDisplay = document.getElementById('display-payment-ci');
            
            if(bankInfo) bankInfo.innerText = `Pago Móvil ${BANK_NAME} (${BANK_CODE})`;
            if(phoneDisplay) phoneDisplay.innerText = PAY_PHONE;
            if(ciDisplay) ciDisplay.innerText = PAY_CI;

            updateUI(); 
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
    } finally {
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
    }
}

// Bloquear UI si está cerrado
function lockRaffleUI() {
    if (btnOpenModal) {
        btnOpenModal.disabled = true;
        btnOpenModal.classList.remove('bg-primary', 'hover:bg-primary-dark');
        btnOpenModal.classList.add('bg-gray-600', 'cursor-not-allowed');
        btnOpenModal.innerHTML = '<span class="material-symbols-outlined">lock</span> SORTEO CERRADO';
    }
    const header = document.querySelector('header');
    const banner = document.createElement('div');
    banner.className = "bg-red-600 text-white text-center text-xs font-bold py-1 tracking-widest uppercase";
    banner.innerText = "⛔ Las ventas han finalizado";
    document.body.insertBefore(banner, document.body.firstChild);
}

// ==========================================
// 4. LÓGICA DE INTERFAZ (UI)
// ==========================================
function updateUI() {
    qtyDisplay.innerText = quantity;
    const total = (quantity * TICKET_PRICE).toFixed(2);
    const totalString = `${CURRENCY} ${total}`;
    
    totalDisplay.innerText = totalString;
    modalTotal.innerText = totalString;

    if (unitPriceDisplay) {
        unitPriceDisplay.innerText = `${CURRENCY} ${TICKET_PRICE.toFixed(2)}`;
    }

    if (quantity <= 1) btnMinus.classList.add('opacity-50', 'cursor-not-allowed');
    else btnMinus.classList.remove('opacity-50', 'cursor-not-allowed');
}

btnMinus.onclick = () => { if (quantity > 1) { quantity--; updateUI(); } };
btnPlus.onclick = () => { if (quantity < MAX_LIMIT) { quantity++; updateUI(); } };

window.addTickets = (amount) => {
    const newQuantity = quantity + amount;
    if (newQuantity <= MAX_LIMIT) {
        quantity = newQuantity;
        updateUI();
    } else {
        showToast(`Máximo ${MAX_LIMIT} tickets`);
        quantity = MAX_LIMIT;
        updateUI();
    }
};

window.resetQuantity = () => {
    quantity = 1;
    updateUI();
};

// ==========================================
// 5. SLIDER
// ==========================================
function initSlider() {
    const imgElement = document.getElementById('hero-image');
    const controls = document.getElementById('slider-controls');
    const dotsContainer = document.getElementById('slider-dots');

    if(!imgElement) return;
    imgElement.src = sliderImages[0];

    if (sliderImages.length > 1) {
        controls.classList.remove('hidden');
        dotsContainer.innerHTML = '';
        sliderImages.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `w-2 h-2 rounded-full transition-colors ${idx === 0 ? 'bg-primary' : 'bg-white/50'}`;
            dotsContainer.appendChild(dot);
        });
        startSlideTimer();
    }
}

function showSlide(index) {
    const imgElement = document.getElementById('hero-image');
    const dots = document.getElementById('slider-dots').children;
    imgElement.style.opacity = 0;
    setTimeout(() => {
        imgElement.src = sliderImages[index];
        imgElement.style.opacity = 1;
        for (let dot of dots) dot.classList.replace('bg-primary', 'bg-white/50');
        dots[index].classList.replace('bg-white/50', 'bg-primary');
    }, 150);
    currentSlide = index;
}

window.nextSlide = () => {
    let next = (currentSlide + 1) % sliderImages.length;
    showSlide(next);
    resetSlideTimer();
};

window.prevSlide = () => {
    let prev = (currentSlide - 1 + sliderImages.length) % sliderImages.length;
    showSlide(prev);
    resetSlideTimer();
};

function startSlideTimer() {
    slideInterval = setInterval(window.nextSlide, 4000);
}

function resetSlideTimer() {
    clearInterval(slideInterval);
    startSlideTimer();
}

// ==========================================
// 6. UTILIDADES
// ==========================================
function updateProgressBar(sold, total) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if (bar && text) {
        let percent = (sold / total) * 100;
        if (percent > 100) percent = 100;
        bar.style.width = `${percent}%`;
        text.innerText = `${sold} / ${total}`;
    }
}

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    if(toast && toastMsg) {
        toastMsg.innerText = message;
        toast.classList.remove('translate-x-full', 'opacity-0');
        setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); }, 3000);
    } else { alert(message); }
}

window.copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    showToast(`Copiado: ${texto}`);
};

window.copyAllPaymentData = () => {
    const currentTotal = (quantity * TICKET_PRICE).toFixed(2);
    
    // Usamos las variables globales cargadas desde el servidor
    const paymentInfo = `Banco: ${BANK_NAME} (${BANK_CODE})\nTeléfono: ${PAY_PHONE}\nCédula/RIF: ${PAY_CI}\nMonto a Pagar: ${CURRENCY} ${currentTotal}`;
    
    navigator.clipboard.writeText(paymentInfo)
        .then(() => showToast("¡Datos copiados!"))
        .catch(() => showToast("Error al copiar"));
};

// Modal de Error
window.showPaymentError = (ref, date, amount) => {
    document.getElementById('err-ref').innerText = ref;
    document.getElementById('err-date').innerText = date;
    document.getElementById('err-amount').innerText = amount;
    errorModal.classList.remove('hidden');
    setTimeout(() => errorModal.classList.remove('opacity-0'), 10);
};

window.closeErrorModal = () => {
    errorModal.classList.add('opacity-0');
    setTimeout(() => errorModal.classList.add('hidden'), 300);
};

// ==========================================
// 7. ENVÍO DE COMPRA
// ==========================================
if(btnOpenModal) btnOpenModal.onclick = () => modal.classList.remove('hidden');
const closeModal = () => modal.classList.add('hidden');
if(btnCloseModal) btnCloseModal.onclick = closeModal;
if(backdrop) backdrop.onclick = closeModal;

// Auto-fecha hoy
const dateInput = document.getElementById('input-date');
if (dateInput) {
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localIso;
}

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnText = document.getElementById('btn-text');
    const originalText = btnText.innerText;
    
    btnText.innerText = "Verificando con el Banco...";
    btnText.disabled = true;
    
    const ciType = document.getElementById('input-ci-type').value;
    const ciNumber = document.getElementById('input-ci-number').value;
    const fullCi = ciType + ciNumber; 

    const userData = {
        name: document.getElementById('input-name').value,
        ci: fullCi,
        phone: document.getElementById('input-phone').value,
        email: document.getElementById('input-email').value, 
        ref: document.getElementById('input-ref').value,
        paymentDate: document.getElementById('input-date').value,
    };

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: userData,
                quantity: quantity
            })
        });

        const result = await response.json();

        if (response.status === 402) {
            const totalShow = (quantity * TICKET_PRICE).toFixed(2) + " " + CURRENCY;
            showPaymentError(userData.ref, userData.paymentDate, totalShow);
            throw new Error("SILENT_FAIL"); 
        }

        if (response.status === 409) {
            showToast("⚠️ Esta referencia ya fue utilizada.");
            throw new Error("SILENT_FAIL");
        }

        if (!response.ok) throw new Error(result.error || "Error del servidor");

        // ÉXITO
        const successModal = document.getElementById('success-modal');
        const numbersContainer = document.getElementById('assigned-numbers-display');
        numbersContainer.innerHTML = '';
        if(result.numbers && Array.isArray(result.numbers)) {
            result.numbers.forEach(num => {
                const badge = document.createElement('div');
                badge.className = "bg-primary text-background-dark font-extrabold text-xl w-12 h-12 flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(19,236,91,0.4)] border border-white/20 animate-bounce-short";
                badge.innerText = num;
                numbersContainer.appendChild(badge);
            });
        }

        modal.classList.add('hidden'); 
        successModal.classList.remove('hidden'); 

    } catch (error) {
        console.error("Resultado:", error);
        if (error.message !== "SILENT_FAIL") showToast(error.message);
        btnText.innerText = originalText;
        btnText.disabled = false;
    }
});

// Inicializar
loadRaffleConfig();