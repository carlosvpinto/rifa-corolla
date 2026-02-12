// ==========================================
// CONFIGURACIÓN (LOCAL / PROD)
// ==========================================
// ⚠️ URL DE PRODUCCIÓN
// const API_URL = "https://rifa-carros-corolla.onrender.com/api/saas/buy";
// const MASTER_CONFIG_URL = "https://rifa-carros-corolla.onrender.com/api/master/config";
// const API_RATE = "https://rifa-carros-corolla.onrender.com/api/tasa";

// ⚠️ URL LOCAL
const API_URL = "http://localhost:3000/api/saas/buy";
const MASTER_CONFIG_URL = "http://localhost:3000/api/master/config";
const API_RATE = "http://localhost:3000/api/tasa";

// Variables Globales
let SOFTWARE_PRICE_USD = 50; 
let EXCHANGE_RATE = 0;
let SOFTWARE_PRICE_VES = 0;
let USER_COUNTRY = 'VE'; 

// ==========================================
// 1. CARGAR DATOS + GEOLOCALIZACIÓN
// ==========================================
async function initLanding() {
    try {
        console.log("🌍 Iniciando sistema de ventas...");
        
        const [configRes, rateRes, geoRes] = await Promise.all([
            fetch(MASTER_CONFIG_URL),
            fetch(API_RATE),
            fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({ country_code: 'VE' }))
        ]);

        const configData = await configRes.json();
        const rateData = await rateRes.json();
        USER_COUNTRY = geoRes.country_code || 'VE';

        //USER_COUNTRY= 'US';

        // 1. Configurar Precios
        if (configData.softwarePrice) SOFTWARE_PRICE_USD = parseFloat(configData.softwarePrice);
        if (rateData.rate) EXCHANGE_RATE = parseFloat(rateData.rate); else EXCHANGE_RATE = 60; 

        SOFTWARE_PRICE_VES = SOFTWARE_PRICE_USD * EXCHANGE_RATE;
        const vesFormatted = SOFTWARE_PRICE_VES.toFixed(2);

        console.log(`📍 País: ${USER_COUNTRY} | Precio: $${SOFTWARE_PRICE_USD} | Tasa: ${EXCHANGE_RATE}`);

        // --- ACTUALIZAR INTERFAZ ---

        // A. Precio Grande (Sección de abajo) - Siempre en USD
        const bigPrice = document.getElementById('display-price-big');
        if (bigPrice) bigPrice.innerText = `$${SOFTWARE_PRICE_USD}`;

        // B. Modal: Precio en Bolívares
        const modalPriceBs = document.getElementById('display-saas-price-bs');
        if (modalPriceBs) modalPriceBs.innerText = `Bs. ${vesFormatted}`;

        // C. Modal: Precio en Dólares (PayPal)
        const modalPriceUsd = document.getElementById('display-saas-price-usd');
        if (modalPriceUsd) modalPriceUsd.innerText = `$${SOFTWARE_PRICE_USD}`;

        // D. Botón Principal (Header)
        const btnDisplay = document.getElementById('btn-buy-license');
        const tabBs = document.getElementById('tab-bs');

        if (USER_COUNTRY === 'VE') {
            // MODO VENEZUELA
            if (btnDisplay) {
                btnDisplay.innerHTML = `Obtener Licencia <br><span class="text-sm font-normal">$${SOFTWARE_PRICE_USD} (Bs. ${vesFormatted})</span>`;
            }
            // Asegurar que el botón de copiar copie Bs
            const copyPriceBtn = document.getElementById('btn-copy-price');
            if (copyPriceBtn) copyPriceBtn.onclick = function() { copyText(vesFormatted, this); };

        } else {
            // MODO INTERNACIONAL
            if (btnDisplay) {
                btnDisplay.innerHTML = `Obtener Licencia <br><span class="text-sm font-normal">Precio Único: $${SOFTWARE_PRICE_USD}</span>`;
            }
            // Ocultar pestaña Bs y forzar USD
            if (tabBs) tabBs.classList.add('hidden');
            switchPayment('usd');
        }

    } catch (error) {
        console.error("Error inicializando:", error);
    }
}

initLanding();

// ==========================================
// 2. UTILIDADES UI
// ==========================================
window.switchPayment = (type) => {
    const secBs = document.getElementById('section-bs');
    const secUsd = document.getElementById('section-usd');
    const tabBs = document.getElementById('tab-bs');
    const tabUsd = document.getElementById('tab-usd');

    if (type === 'bs') {
        secBs.classList.remove('hidden');
        secUsd.classList.add('hidden');
        tabBs.classList.replace('text-gray-400', 'text-background-dark');
        tabBs.classList.add('bg-primary');
        tabUsd.classList.remove('bg-blue-500', 'text-white');
        tabUsd.classList.add('text-gray-400');
    } else {
        secBs.classList.add('hidden');
        secUsd.classList.remove('hidden');
        tabUsd.classList.remove('text-gray-400');
        tabUsd.classList.add('bg-blue-500', 'text-white');
        if (!tabBs.classList.contains('hidden')) {
            tabBs.classList.remove('bg-primary', 'text-background-dark');
            tabBs.classList.add('text-gray-400');
        }
    }
};

window.copyText = (text, btnElement) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalIcon = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="material-symbols-outlined text-green-400 font-bold">check</span>`;
        setTimeout(() => btnElement.innerHTML = originalIcon, 2000);
    });
};

window.copyAllSaasData = (btnElement) => {
    const textToCopy = `Banco: Mercantil (0105)\nTeléfono: 0424-3454032\nRIF: J-506818817\nMonto: Bs. ${SOFTWARE_PRICE_VES.toFixed(2)} ($${SOFTWARE_PRICE_USD})`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="material-symbols-outlined text-green-400">check_circle</span> Copiado`;
        setTimeout(() => btnElement.innerHTML = originalContent, 2000);
    });
};

// ==========================================
// 3. MODAL Y FORMULARIOS
// ==========================================
const modal = document.getElementById('purchase-modal');
window.openPurchaseModal = () => { 
    if(modal) {
        modal.classList.remove('hidden');
        if (USER_COUNTRY !== 'VE') switchPayment('usd');
    }
};
window.closePurchaseModal = () => { if(modal) modal.classList.add('hidden'); };

const dateInput = document.getElementById('payment-date');
if (dateInput) {
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localIso;
}

// 4. ENVÍO PAGO MÓVIL
const saasFormBs = document.getElementById('saas-form-bs');
if (saasFormBs) {
    saasFormBs.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Verificando..."; btn.disabled = true;

        const data = {
            method: 'mercantil',
            buyerData: {
                name: document.getElementById('buyer-name').value,
                ci: document.getElementById('buyer-ci').value,
                phone: document.getElementById('buyer-phone').value,
                email: document.getElementById('buyer-email').value,
                companyName: document.getElementById('raffle-name').value 
            },
            raffleName: document.getElementById('raffle-name').value,
            paymentRef: document.getElementById('payment-ref').value,
            paymentDate: document.getElementById('payment-date').value,
            amount: SOFTWARE_PRICE_USD 
        };
        sendPurchase(data, btn, originalText);
    });
}

// 5. ENVÍO PAYPAL
if (window.paypal) {
    paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
        createOrder: function(data, actions) {
            const name = document.getElementById('paypal-name').value;
            const email = document.getElementById('paypal-email').value;
            const raffle = document.getElementById('paypal-raffle-name').value;
            
            if(!name || !email || !raffle) {
                alert("Por favor completa tu Nombre, Correo y Nombre de la Rifa.");
                return false; 
            }
            return actions.order.create({
                purchase_units: [{ amount: { value: SOFTWARE_PRICE_USD.toString() } }]
            });
        },
        onApprove: function(data, actions) {
            return actions.order.capture().then(function(details) {
                const serverData = {
                    method: 'paypal',
                    paypalOrderID: details.id,
                    buyerData: {
                        name: document.getElementById('paypal-name').value,
                        email: document.getElementById('paypal-email').value,
                        phone: "N/A (PayPal)", 
                        ci: "N/A (PayPal)",
                        companyName: document.getElementById('paypal-raffle-name').value
                    },
                    raffleName: document.getElementById('paypal-raffle-name').value,
                    paymentRef: details.id,
                    amount: SOFTWARE_PRICE_USD
                };
                const dummyBtn = { innerText: "", disabled: false, classList: { replace: () => {}, remove: () => {}, add: () => {} } };
                sendPurchase(serverData, dummyBtn, "");
            });
        }
    }).render('#paypal-button-container');
}

// 6. FUNCIÓN DE ENVÍO (ACTUALIZADA)
async function sendPurchase(data, btn, originalText) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok) {
            // 1. Cerrar Modal de Pago
            closePurchaseModal();
            
            // 2. Configurar Modal de Éxito
            const successModal = document.getElementById('saas-success-modal');
            const emailDisplay = document.getElementById('success-email-display');
            const goBtn = document.getElementById('btn-go-dashboard');

            // Poner el correo real
            if (emailDisplay) emailDisplay.innerText = data.buyerData.email;
            
            // Configurar botón
            if (goBtn) {
                goBtn.onclick = () => {
                    window.location.href = result.redirectUrl;
                };
            }

            // 3. Mostrar Modal
            if (successModal) successModal.classList.remove('hidden');

            // (Opcional) Redirección automática en 10 segundos por si acaso
            setTimeout(() => {
                window.location.href = result.redirectUrl;
            }, 10000);

        } else {
            alert("❌ " + (result.error || "Error en la compra"));
            if(btn.innerText) { btn.innerText = originalText; btn.disabled = false; }
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión");
        if(btn.innerText) { btn.innerText = originalText; btn.disabled = false; }
    }
}