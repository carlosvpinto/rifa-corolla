// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES
// ==========================================
const BACKEND_URL = "http://localhost:3000/api/comprar";
const CONFIG_URL = "http://localhost:3000/api/config"; 

// Variables Globales (Valores por defecto)
let TICKET_PRICE = 5; 
let CURRENCY = '$';
let quantity = 1;
const MAX_LIMIT = 10000; // Límite de seguridad

// Variables del Slider de Imágenes
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

// ==========================================
// 3. CARGAR CONFIGURACIÓN DESDE EL SERVIDOR
// ==========================================
async function loadRaffleConfig() {
    try {
        const response = await fetch(CONFIG_URL);
        const data = await response.json();
        
        if (data.ticketPrice) {
            // A. Configurar Precios y Moneda
            TICKET_PRICE = parseFloat(data.ticketPrice);
            CURRENCY = data.currency || '$';
            
            // B. Configurar Barra de Progreso
            const totalTickets = parseInt(data.totalTickets) || 100;
            const manualSold = parseInt(data.manualSold) || 0;
            updateProgressBar(manualSold, totalTickets);

            // C. Configurar Slider de Imágenes (Storage)
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                sliderImages = data.images;
                initSlider(); // Iniciar el carrusel
            }

            // Actualizar textos
            updateUI(); 
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
    }
}

// ==========================================
// 4. LÓGICA DE INTERFAZ (UI)
// ==========================================
function updateUI() {
    // 1. Actualizar cantidad
    qtyDisplay.innerText = quantity;
    
    // 2. Calcular total
    const total = (quantity * TICKET_PRICE).toFixed(2);
    
    // 3. Actualizar Textos con Moneda
    // IMPORTANTE: El HTML debe tener <span id="total-display"></span> sin el signo $ afuera
    totalDisplay.innerText = `${CURRENCY} ${total}`;
    modalTotal.innerText = `${CURRENCY} ${total}`;

    // 4. Actualizar Precio Unitario en el Header
    if (unitPriceDisplay) {
        unitPriceDisplay.innerText = `${CURRENCY} ${TICKET_PRICE.toFixed(2)}`;
    }

    // 5. Estado de botones
    if (quantity <= 1) btnMinus.classList.add('opacity-50', 'cursor-not-allowed');
    else btnMinus.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Eventos de botones (+ y -)
btnMinus.onclick = () => { if (quantity > 1) { quantity--; updateUI(); } };
btnPlus.onclick = () => { if (quantity < MAX_LIMIT) { quantity++; updateUI(); } };

// Funciones para botones rápidos (+3, +5, +20)
window.addTickets = (amount) => {
    const newQuantity = quantity + amount;
    if (newQuantity <= MAX_LIMIT) {
        quantity = newQuantity;
        updateUI();
    } else {
        showToast(`El máximo es ${MAX_LIMIT} tickets`);
        quantity = MAX_LIMIT;
        updateUI();
    }
};

window.resetQuantity = () => {
    quantity = 1;
    updateUI();
};

// ==========================================
// 5. LÓGICA DEL SLIDER (IMÁGENES DE FIREBASE)
// ==========================================
function initSlider() {
    const imgElement = document.getElementById('hero-image');
    const controls = document.getElementById('slider-controls');
    const dotsContainer = document.getElementById('slider-dots');

    if(!imgElement) return;

    // Mostrar primera imagen
    imgElement.src = sliderImages[0];

    // Si hay más de una imagen, activar controles
    if (sliderImages.length > 1) {
        controls.classList.remove('hidden');
        
        // Crear puntos indicadores
        dotsContainer.innerHTML = '';
        sliderImages.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `w-2 h-2 rounded-full transition-colors ${idx === 0 ? 'bg-primary' : 'bg-white/50'}`;
            dotsContainer.appendChild(dot);
        });

        // Iniciar auto-play
        startSlideTimer();
    }
}

function showSlide(index) {
    const imgElement = document.getElementById('hero-image');
    const dots = document.getElementById('slider-dots').children;
    
    // Transición suave
    imgElement.style.opacity = 0;
    
    setTimeout(() => {
        imgElement.src = sliderImages[index];
        imgElement.style.opacity = 1;
        
        // Actualizar puntos
        for (let dot of dots) dot.classList.replace('bg-primary', 'bg-white/50');
        dots[index].classList.replace('bg-white/50', 'bg-primary');
    }, 150);

    currentSlide = index;
}

// Funciones globales para las flechas HTML
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
    slideInterval = setInterval(window.nextSlide, 4000); // Cambia cada 4 seg
}

function resetSlideTimer() {
    clearInterval(slideInterval);
    startSlideTimer();
}

// ==========================================
// 6. BARRA DE PROGRESO
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

// ==========================================
// 7. UTILIDADES (TOAST)
// ==========================================
function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    if(toast && toastMsg) {
        toastMsg.innerText = message;
        toast.classList.remove('translate-x-full', 'opacity-0');
        setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); }, 3000);
    } else {
        alert(message);
    }
}

window.copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    showToast(`Copiado: ${texto}`);
};

// ... (debajo de window.copiar) ...

// NUEVA FUNCIÓN: Copiar todos los datos bancarios + Monto
window.copyAllPaymentData = () => {
    // 1. Calcular el total actual
    const currentTotal = (quantity * TICKET_PRICE).toFixed(2);
    
    // 2. Construir el texto ordenado para pegar en el banco
    const paymentInfo = `
Banco: Mercantil (0105)
Teléfono: 0414-1234567
Cédula/RIF: J-123456789
Monto a Pagar: ${CURRENCY} ${currentTotal}
    `.trim(); // .trim() quita espacios al inicio y final

    // 3. Copiar al portapapeles
    navigator.clipboard.writeText(paymentInfo).then(() => {
        showToast("¡Datos y monto copiados!");
    }).catch(err => {
        console.error('Error al copiar: ', err);
        showToast("Error al copiar");
    });
};
// ==========================================
// 8. ENVÍO DE COMPRA AL BACKEND
// ==========================================
if(btnOpenModal) btnOpenModal.onclick = () => modal.classList.remove('hidden');
const closeModal = () => modal.classList.add('hidden');
if(btnCloseModal) btnCloseModal.onclick = closeModal;
if(backdrop) backdrop.onclick = closeModal;

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnText = document.getElementById('btn-text');
    const originalText = btnText.innerText;
    
    btnText.innerText = "Procesando...";
    btnText.disabled = true;
    
    const userData = {
        name: document.getElementById('input-name').value,
        ci: document.getElementById('input-ci').value,
        phone: document.getElementById('input-phone').value,
        email: document.getElementById('input-email').value, 
        ref: document.getElementById('input-ref').value,
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

        if (!response.ok) throw new Error(result.error || "Error del servidor");

        // Mostrar Éxito
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
        console.error("Error:", error);
        showToast(error.message);
        btnText.innerText = originalText;
        btnText.disabled = false;
    }
});

// ==========================================
// 9. INICIALIZAR APP
// ==========================================
loadRaffleConfig();