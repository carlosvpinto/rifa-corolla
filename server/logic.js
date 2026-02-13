
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// AGREGAMOS STORAGE AQUÍ:
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. OBTENER ID DEL CLIENTE DE LA URL
const urlParams = new URLSearchParams(window.location.search);
const CLIENT_ID = urlParams.get('id') || 'demo'; // 'demo' es tu rifa personal

// 2. CONFIGURACIÓN DINÁMICA
// ⚠️ URL PRODUCCIÓN
const BASE_API = "https://rifa-carros-corolla.onrender.com/api";


const BACKEND_URL = `${BASE_API}/${CLIENT_ID}/comprar`;
const CONFIG_URL = `${BASE_API}/${CLIENT_ID}/config`;

// ... (El resto del archivo sigue igual) Local
//const BASE_API = "http://localhost:3000/api";
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

// VARIABLES GLOBALES NUEVAS
let BINANCE_EMAIL = "";
let ZELLE_EMAIL = "";
let CURRENT_METHOD = "pago_movil"; // pago_movil, binance, zelle

let EXCHANGE_RATE = 0; // Tasa del día

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



// 🔴 TUS CREDENCIALES
const firebaseConfig = {
  apiKey: "AIzaSyC6ogR8wwRSiPnZBUkPrkhXaFGZA1e_Krs",
  authDomain: "rifa-corolla.firebaseapp.com",
  projectId: "rifa-corolla",
  storageBucket: "rifa-corolla.firebasestorage.app", 
  messagingSenderId: "715627839956",
  appId: "1:715627839956:web:90261c05c603e949559641",
  measurementId: "G-W347VQ8NMN"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
// ==========================================
// 3. CARGAR CONFIGURACIÓN + TASA DE CAMBIO
// ==========================================
async function loadRaffleConfig() {
    const appLoader = document.getElementById('app-loader');
    const heroLoader = document.getElementById('hero-loader'); 
    
    try {
        console.log("⏳ Conectando al servidor...");
        
        // 1. OBTENER CONFIGURACIÓN DE LA RIFA
        const response = await fetch(CONFIG_URL);
        if (!response.ok) throw new Error("Servidor respondió con error: " + response.status);
        const data = await response.json();

         // NUEVO: Descripción
            const descText = data.raffleDescription || "¡Participa y gana! Sorteo autorizado. Compra tu ticket hoy mismo.";
            const descDisplay = document.getElementById('raffle-description-display');
            if (descDisplay) descDisplay.innerText = descText;
        
        console.log("✅ Configuración cargada:", data);

        // 2. OBTENER TASA DE CAMBIO (NUEVO)
        // Usamos la BASE_API definida al inicio del archivo
        try {

               


            const rateResponse = await fetch(`${BASE_API}/tasa`);
            const rateData = await rateResponse.json();
            
            if (rateData.rate) {
                EXCHANGE_RATE = parseFloat(rateData.rate);
                console.log("💵 Tasa del día cargada:", EXCHANGE_RATE);
            } else {
                console.warn("⚠️ No se recibió tasa, usando 0.");
            }
        } catch (rateError) {
            console.error("Error obteniendo tasa:", rateError);
            // No detenemos la app, solo no mostrará Bs.
        }

        // --- A. VERIFICAR ESTADO ---
        if (data.isClosed) lockRaffleUI();

        // --- B. PRECIOS Y MONEDA ---
        if (data.ticketPrice) {
            TICKET_PRICE = parseFloat(data.ticketPrice);
            CURRENCY = data.currency || '$';
        }
            
        // --- C. BARRA DE PROGRESO ---
        const totalTickets = parseInt(data.totalTickets) || 100;
        const manualSold = parseInt(data.manualSold) || 0;
        updateProgressBar(manualSold, totalTickets);

        // --- D. SLIDER DE IMÁGENES ---
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            sliderImages = data.images;
            initSlider(); 
        } else {
            // Si conecta pero no hay fotos, quitamos el loader de la imagen
            if(heroLoader) heroLoader.classList.add('hidden');
        }

          // G. CARGAR BINANCE Y ZELLE
            if (data.binanceEmail) {
                BINANCE_EMAIL = data.binanceEmail;
                const tabBinance = document.getElementById('tab-binance');
                if(tabBinance) tabBinance.classList.remove('hidden');
            }
            if (data.zelleEmail) {
                ZELLE_EMAIL = data.zelleEmail;
                const tabZelle = document.getElementById('tab-zelle');
                if(tabZelle) tabZelle.classList.remove('hidden');
            }

            // Inicializar la vista en Pago Móvil
            setPaymentMethod('pago_movil');

        // --- E. TEXTOS (TÍTULO Y CÓDIGO) ---
        const titleText = data.raffleTitle || "Gran Rifa";
        const codeText = data.drawCode || "Sorteo General";

        // Actualizar Header
        const headerTitle = document.getElementById('raffle-title-display');
        const headerCode = document.getElementById('draw-code-display');
        if(headerTitle) headerTitle.innerText = titleText;
        if(headerCode) headerCode.innerText = codeText;

        // Actualizar Hero
        const heroTitle = document.getElementById('hero-title-display');
        const heroCode = document.getElementById('hero-code-display');
        if(heroTitle) heroTitle.innerText = titleText;
        if(heroCode) heroCode.innerText = codeText;

        // --- F. DATOS BANCARIOS ---
        if (data.bankName) BANK_NAME = data.bankName;
        if (data.bankCode) BANK_CODE = data.bankCode;
        if (data.paymentPhone) PAY_PHONE = data.paymentPhone;
        if (data.paymentCI) PAY_CI = data.paymentCI;

        const bankInfo = document.getElementById('display-bank-info');
        const phoneDisplay = document.getElementById('display-payment-phone');
        const ciDisplay = document.getElementById('display-payment-ci');
        
        if(bankInfo) bankInfo.innerText = `Pago Móvil ${BANK_NAME} (${BANK_CODE})`;
        if(phoneDisplay) phoneDisplay.innerText = PAY_PHONE;
        if(ciDisplay) ciDisplay.innerText = PAY_CI;

        const btnPhone = document.getElementById('btn-copy-phone');
        const btnCi = document.getElementById('btn-copy-ci');
        
        if(btnPhone) {
            const newBtn = btnPhone.cloneNode(true); // Clonar para limpiar eventos
            btnPhone.parentNode.replaceChild(newBtn, btnPhone);
            newBtn.onclick = (e) => { e.preventDefault(); window.copiar(PAY_PHONE); };
        }
        if(btnCi) {
            const newBtn = btnCi.cloneNode(true);
            btnCi.parentNode.replaceChild(newBtn, btnCi);
            newBtn.onclick = (e) => { e.preventDefault(); window.copiar(PAY_CI); };
        }

        // --- G. BRANDING ---
        if (data.logoUrl) {
            const logoImg = document.getElementById('custom-logo-img');
            const defaultIcon = document.getElementById('default-logo-icon');
            if (logoImg && defaultIcon) {
                logoImg.src = data.logoUrl;
                logoImg.classList.remove('hidden');
                defaultIcon.classList.add('hidden');
            }
        }
        if (data.faviconUrl) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'shortcut icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = data.faviconUrl;
        }
        if (data.companyName) document.title = data.companyName;

        // Actualizar UI con el precio y la tasa cargada
        updateUI(); 

    } catch (error) {
        console.error("❌ ERROR DE CONEXIÓN:", error);
        
        // MODO "OFFLINE" - Fallback visual
        if(heroLoader) {
            heroLoader.innerHTML = `
                <div class="text-center p-4">
                    <span class="material-symbols-outlined text-4xl text-red-500 mb-2">wifi_off</span>
                    <p class="text-xs text-red-400 font-bold tracking-widest">SIN CONEXIÓN</p>
                </div>
            `;
            heroLoader.classList.remove('animate-pulse');
        }
        if(unitPriceDisplay) unitPriceDisplay.innerText = "--";

    } finally {
        // Siempre quitar pantalla de carga
        if (appLoader) {
            appLoader.classList.add('opacity-0');
            setTimeout(() => appLoader.classList.add('hidden'), 500);
        }
    }
}

// ==========================================
// 9. LÓGICA DE PESTAÑAS DE PAGO
// ==========================================
// CORRECCIÓN PUNTOS 1 y 3: Inyectar datos con botones de copiar
// ==========================================
// 9. LÓGICA DE PESTAÑAS DE PAGO (CORREGIDA)
// ==========================================

// ==========================================
// 9. LÓGICA DE PESTAÑAS (SetPaymentMethod)
// ==========================================
window.setPaymentMethod = (method) => {
    CURRENT_METHOD = method;
    const infoBox = document.getElementById('payment-info-box');
    const labelRef = document.getElementById('label-ref');
    const inputRef = document.getElementById('input-ref');
    const btnCopyAll = document.getElementById('btn-copy-all');
    
    // Recalcular montos al cambiar de pestaña
    const { usd, ves } = calculateAmounts();
    
    updateModalPrice(usd, ves);

    // 1. Resetear estilos tabs
    ['pm', 'binance', 'zelle'].forEach(m => {
        const tab = document.getElementById(`tab-${m}`);
        const target = (method === 'pago_movil') ? 'pm' : method;
        if(tab) {
            tab.className = (m === target) 
                ? "flex-1 py-2 text-xs font-bold rounded-lg bg-surface-highlight text-white border border-primary/50 transition-all shadow-lg"
                : "flex-1 py-2 text-xs font-bold rounded-lg bg-black/30 text-gray-500 border border-transparent hover:text-white transition-all";
        }
    });

    // 2. Contenido dinámico
    if (method === 'pago_movil') {
        infoBox.innerHTML = `
            <div class="flex justify-between items-center bg-black/20 p-2 rounded"><span class="text-gray-400">Banco:</span> <span class="font-bold text-white font-mono">${BANK_NAME} (${BANK_CODE})</span></div>
            <div class="flex justify-between items-center bg-black/20 p-2 rounded"><span class="text-gray-400">Tlf:</span> <span class="font-bold text-white font-mono">${PAY_PHONE}</span></div>
            <div class="flex justify-between items-center bg-black/20 p-2 rounded"><span class="text-gray-400">CI/RIF:</span> <span class="font-bold text-white font-mono">${PAY_CI}</span></div>
        `;
        labelRef.innerText = "Referencia Bancaria (6 últimos)";
        inputRef.value = ""; 
        inputRef.type = "tel"; 
        inputRef.setAttribute("inputmode", "numeric");
        inputRef.maxLength = 12; 
        inputRef.placeholder = "123456";
        inputRef.oninput = function() { this.value = this.value.replace(/[^0-9]/g, ''); };
        if(btnCopyAll) btnCopyAll.classList.remove('hidden');

    } else if (method === 'binance') {
        infoBox.innerHTML = `
            <div class="text-center py-2">
                <span class="text-yellow-400 font-bold block mb-2 text-lg">BINANCE PAY</span>
                <div class="bg-yellow-400/10 border border-yellow-400/30 p-3 rounded-lg break-all">
                    <span class="text-white font-mono text-sm">${BINANCE_EMAIL}</span>
                </div>
                <button onclick="window.copiar('${BINANCE_EMAIL}')" class="mt-3 text-xs text-yellow-400 hover:text-white underline">Copiar Correo/ID</button>
            </div>
        `;
        labelRef.innerText = "Tu ID de Binance o Correo";
        inputRef.value = "";
        inputRef.type = "text";
        inputRef.removeAttribute("inputmode");
        inputRef.maxLength = 50;
        inputRef.placeholder = "ejemplo@gmail.com";
        inputRef.oninput = null;
        if(btnCopyAll) btnCopyAll.classList.add('hidden');

    } else if (method === 'zelle') {
        infoBox.innerHTML = `
            <div class="text-center py-2">
                <span class="text-purple-400 font-bold block mb-2 text-lg">ZELLE</span>
                <div class="bg-purple-400/10 border border-purple-400/30 p-3 rounded-lg break-all">
                    <span class="text-white font-mono text-sm">${ZELLE_EMAIL}</span>
                </div>
                <button onclick="window.copiar('${ZELLE_EMAIL}')" class="mt-3 text-xs text-purple-400 hover:text-white underline">Copiar Zelle</button>
            </div>
        `;
        labelRef.innerText = "Nombre del Titular Zelle";
        inputRef.value = "";
        inputRef.type = "text";
        inputRef.removeAttribute("inputmode");
        inputRef.maxLength = 50;
        inputRef.placeholder = "Nombre Apellido";
        inputRef.oninput = null;
        if(btnCopyAll) btnCopyAll.classList.add('hidden');
    }
};

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
// 4. LÓGICA DE INTERFAZ (UI) - ACTUALIZADA
// ==========================================
// ==========================================
// NUEVA FUNCIÓN AUXILIAR: CALCULAR MONTOS
// ==========================================
function calculateAmounts() {
    let valUSD, valVES;
    const rawTotal = quantity * TICKET_PRICE;

    if (CURRENCY === 'Bs.' || CURRENCY === 'Bs') {
        // Si el precio base es Bs.
        valVES = rawTotal;
        valUSD = EXCHANGE_RATE > 0 ? valVES / EXCHANGE_RATE : 0;
    } else {
        // Si el precio base es $ (o cualquier otro)
        valUSD = rawTotal;
        valVES = valUSD * EXCHANGE_RATE;
    }
    return { usd: valUSD, ves: valVES };
}

// ==========================================
// 4. LÓGICA DE INTERFAZ (UI) - ACTUALIZADA
// ==========================================
function updateUI() {
    qtyDisplay.innerText = quantity;
    
    // Usamos la nueva función de cálculo
    const { usd, ves } = calculateAmounts();
    
    // Texto principal
    const totalString = `$${usd.toFixed(2)} / Bs. ${ves.toFixed(2)}`;
    
    totalDisplay.innerText = totalString;
    
    // Actualizar Modal si está abierto
    if (!document.getElementById('checkout-modal').classList.contains('hidden')) {
        updateModalPrice(usd, ves);
    }

    // Precio Unitario (Tarjeta)
    if (unitPriceDisplay) {
        // Si la moneda es Bs, mostramos Bs grande y $ pequeño
        if (CURRENCY === 'Bs.' || CURRENCY === 'Bs') {
            const unitUSD = EXCHANGE_RATE > 0 ? TICKET_PRICE / EXCHANGE_RATE : 0;
            unitPriceDisplay.innerHTML = `Bs. ${TICKET_PRICE.toFixed(2)}<br><span class="text-sm font-normal text-gray-400">$${unitUSD.toFixed(2)}</span>`;
        } else {
            // Si es $, mostramos $ grande y Bs pequeño
            const unitVES = TICKET_PRICE * EXCHANGE_RATE;
            unitPriceDisplay.innerHTML = `$${TICKET_PRICE.toFixed(2)}<br><span class="text-sm font-normal text-gray-400">Bs. ${unitVES.toFixed(2)}</span>`;
        }
    }

    if (quantity <= 1) btnMinus.classList.add('opacity-50', 'cursor-not-allowed');
    else btnMinus.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Función auxiliar para actualizar precio del modal
function updateModalPrice(usd, ves) {
    const modalTotal = document.getElementById('modal-total');
    if (!modalTotal) return;

    if (CURRENT_METHOD === 'pago_movil') {
        modalTotal.innerText = `Bs. ${ves.toFixed(2)}`;
        modalTotal.classList.add('text-primary'); 
        modalTotal.classList.remove('text-yellow-400', 'text-purple-400');
    } else {
        modalTotal.innerText = `$${usd.toFixed(2)}`;
        // Color según método
        if (CURRENT_METHOD === 'binance') {
            modalTotal.classList.add('text-yellow-400');
            modalTotal.classList.remove('text-primary', 'text-purple-400');
        } else {
            modalTotal.classList.add('text-purple-400');
            modalTotal.classList.remove('text-primary', 'text-yellow-400');
        }
    }
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
// ==========================================
// 5. SLIDER (MEJORADO CON PRELOADER)
// ==========================================
function initSlider() {
    const imgElement = document.getElementById('hero-image');
    const loader = document.getElementById('hero-loader'); 
    const controls = document.getElementById('slider-controls');
    const dotsContainer = document.getElementById('slider-dots');

    if(!imgElement) return;

    // SEGURIDAD: Si no hay imágenes, ocultar loader y mostrar algo por defecto (o dejar vacío)
    if (!sliderImages || sliderImages.length === 0) {
        if(loader) loader.classList.add('hidden'); // Quitar cargador para que no estorbe
        return;
    }

    // Cargar primera imagen
    loadImageSmoothly(imgElement, loader, sliderImages[0]);

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

// Función auxiliar para cargar imagen sin parpadeos
function loadImageSmoothly(imgEl, loaderEl, url) {
    // 1. Ocultar imagen actual (si hay)
    imgEl.style.opacity = 0;
    
    // 2. Mostrar loader si tarda mucho (opcional, aquí lo dejamos visible por css si la img es transparente)
    if(loaderEl) loaderEl.classList.remove('hidden');

    // 3. Crear objeto imagen en memoria para descargar antes de mostrar
    const tempImg = new Image();
    tempImg.src = url;
    
    tempImg.onload = () => {
        // Cuando ya descargó:
        imgEl.src = url; // Asignamos al elemento real
        
        // Pequeño delay para asegurar renderizado
        setTimeout(() => {
            if(loaderEl) loaderEl.classList.add('hidden'); // Quitar loader
            imgEl.style.opacity = 1; // Aparecer imagen suavemente
        }, 100);
    };
}

function showSlide(index) {
    const imgElement = document.getElementById('hero-image');
    const dots = document.getElementById('slider-dots').children;
    
    // Simplemente cambiamos el src, la transición CSS opacity hará el resto si quisiéramos,
    // pero para slider rápido mejor cambio directo:
    imgElement.style.opacity = 0;
    
    setTimeout(() => {
        imgElement.src = sliderImages[index];
        imgElement.style.opacity = 1;
        
        // Actualizar puntos
        for (let dot of dots) dot.classList.replace('bg-primary', 'bg-white/50');
        dots[index].classList.replace('bg-white/50', 'bg-primary');
    }, 200);

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

// ==========================================
// MODIFICAR COPY ALL TAMBIÉN
// ==========================================
window.copyAllPaymentData = () => {
    // Usamos el cálculo nuevo
    const { ves } = calculateAmounts();
    const currentTotal = ves.toFixed(2);
    
    const paymentInfo = `Banco: ${BANK_NAME} (${BANK_CODE})\nTeléfono: ${PAY_PHONE}\nCédula/RIF: ${PAY_CI}\nMonto a Pagar: Bs. ${currentTotal}`;
    
    navigator.clipboard.writeText(paymentInfo).then(() => showToast("¡Datos copiados!")).catch(() => showToast("Error al copiar"));
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
if (btnOpenModal) {
    btnOpenModal.onclick = () => {
        // 1. Mostrar la ventana
        modal.classList.remove('hidden');
        
        // 2. CORRECCIÓN: Forzar la carga de datos de Pago Móvil al abrir
        // Esto asegura que se lean las variables BANK_NAME, PAY_PHONE, etc. actualizadas
        setPaymentMethod('pago_movil'); 
    };
}
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
    btnText.innerText = "Subiendo comprobante...";
    btnText.disabled = true;
    
    // 1. Recopilar Datos Básicos
    const ciType = document.getElementById('input-ci-type').value;
    const ciNumber = document.getElementById('input-ci-number').value;
    const fullCi = ciType + ciNumber; 
    const fileInput = document.getElementById('receipt-upload');
    let receiptUrl = "";

    try {
        // 2. SUBIR IMAGEN (Si existe)
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = ref(storage, `receipts/${CLIENT_ID}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            receiptUrl = await getDownloadURL(storageRef);
            console.log("Comprobante subido:", receiptUrl);
        }

        btnText.innerText = "Verificando...";

        const userData = {
            name: document.getElementById('input-name').value,
            ci: fullCi,
            phone: document.getElementById('input-phone').value,
            email: document.getElementById('input-email').value, 
            ref: document.getElementById('input-ref').value,
            paymentDate: document.getElementById('input-date').value,
            paymentMethod: CURRENT_METHOD, 
            receiptUrl: receiptUrl 
        };

        // 3. ENVIAR AL SERVIDOR (CORREGIDO: Sin duplicar URL)
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: userData,
                quantity: quantity
            })
        });

        const result = await response.json();

        // Manejo de Respuestas
        if (response.status === 402) {
            const totalShow = (quantity * TICKET_PRICE).toFixed(2) + " " + CURRENCY;
            showPaymentError(userData.ref, userData.paymentDate, totalShow);
            throw new Error("SILENT_FAIL"); 
        }
        if (response.status === 409) { showToast("⚠️ Referencia ya utilizada."); throw new Error("SILENT_FAIL"); }
        if (response.status === 403) { showToast("⛔ Sorteo cerrado."); throw new Error("SILENT_FAIL"); }
        if (!response.ok) throw new Error(result.error || "Error servidor");

        // Éxito
        const successModal = document.getElementById('success-modal');
        const numbersContainer = document.getElementById('assigned-numbers-display');
        numbersContainer.innerHTML = '';
        if(result.numbers) {
            result.numbers.forEach(num => {
                const badge = document.createElement('div');
                badge.className = "bg-primary text-background-dark font-extrabold text-xl w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-white/20";
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