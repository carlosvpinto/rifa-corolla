// ==========================================
// CONFIGURACIÓN (LOCAL / PROD)
// ==========================================
// ⚠️ URL DE PRODUCCIÓN
// const API_URL = "https://vendeturifa.com/api/saas/buy";
// const MASTER_CONFIG_URL = "https://vendeturifa.com/api/master/config";
// const API_RATE = "http://localhost:3000/api/api/tasa";

// ⚠️ URL LOCAL
const API_URL = "https://vendeturifa.com/api/saas/buy";
const MASTER_CONFIG_URL = "https://vendeturifa.com/api/master/config";
const API_RATE = "https://vendeturifa.com/api/tasa";

// Variables Globales
let SOFTWARE_PRICE_USD = 50; 
let EXCHANGE_RATE = 0;
let SOFTWARE_PRICE_VES = 0;
let USER_COUNTRY = 'VE'; 

// ==========================================
// 1. CARGAR DATOS + GEOLOCALIZACIÓN (OPTIMIZADO)
// ==========================================
async function initLanding() {
    try {
        console.log("🌍 Iniciando sistema...");
        
        // Función auxiliar para geolocalización con timeout de 1 segundo
        const fetchGeo = () => {
            return new Promise((resolve) => {
                const timer = setTimeout(() => resolve({ country_code: 'VE' }), 1000); // Si tarda > 1s, usa VE
                
                fetch('https://ipapi.co/json/')
                    .then(res => {
                        if(!res.ok) throw new Error("Bloqueo CORS o Red");
                        return res.json();
                    })
                    .then(data => {
                        clearTimeout(timer);
                        resolve(data);
                    })
                    .catch(() => {
                        clearTimeout(timer);
                        resolve({ country_code: 'VE' }); // Fallback silencioso
                    });
            });
        };

        // Ejecutamos todo en paralelo
        const [configRes, rateRes, geoRes] = await Promise.all([
            fetch(MASTER_CONFIG_URL).catch(e => ({ json: () => ({}) })), // Evita romper si falla
            fetch(API_RATE).catch(e => ({ json: () => ({}) })),
            fetchGeo()
        ]);

        const configData = await configRes.json ? await configRes.json() : {};
        const rateData = await rateRes.json ? await rateRes.json() : {};
        
        USER_COUNTRY = geoRes.country_code || 'VE';

        // 1. Configurar Precios
        if (configData.softwarePrice) SOFTWARE_PRICE_USD = parseFloat(configData.softwarePrice);
        if (rateData && rateData.rate) EXCHANGE_RATE = parseFloat(rateData.rate); else EXCHANGE_RATE = 60; 

        SOFTWARE_PRICE_VES = SOFTWARE_PRICE_USD * EXCHANGE_RATE;
        const vesFormatted = SOFTWARE_PRICE_VES.toFixed(2);

        console.log(`📍 País: ${USER_COUNTRY} | Precio: $${SOFTWARE_PRICE_USD} | Tasa: ${EXCHANGE_RATE}`);

        // --- ACTUALIZAR INTERFAZ ---

        const btnDisplay = document.getElementById('btn-buy-license');
        const bigPrice = document.getElementById('display-price-big');
        const modalPriceBs = document.getElementById('display-saas-price-bs');
        const modalPriceUsd = document.getElementById('display-saas-price-usd');
        const tabBs = document.getElementById('tab-bs');
        const copyPriceBtn = document.getElementById('btn-copy-price');

        // Textos
        if (bigPrice) bigPrice.innerText = `$${SOFTWARE_PRICE_USD}`;
        if (modalPriceBs) modalPriceBs.innerText = `Bs. ${vesFormatted}`;
        if (modalPriceUsd) modalPriceUsd.innerText = `$${SOFTWARE_PRICE_USD}`;
        if (copyPriceBtn) copyPriceBtn.onclick = function() { copyText(vesFormatted, this); };

        // Botón y Tabs según País
        if (USER_COUNTRY === 'VE') {
            if (btnDisplay) {
                btnDisplay.innerHTML = `Obtener Licencia <br><span class="text-sm font-normal">$${SOFTWARE_PRICE_USD} (Bs. ${vesFormatted})</span>`;
            }
        } else {
            if (btnDisplay) {
                btnDisplay.innerHTML = `Obtener Licencia <br><span class="text-sm font-normal">Precio Único: $${SOFTWARE_PRICE_USD}</span>`;
            }
            if (tabBs) tabBs.classList.add('hidden');
            switchPayment('usd');
        }

    } catch (error) {
        console.error("Error inicializando (Usando defaults):", error);
        // Fallback visual si todo falla
        const btnDisplay = document.getElementById('btn-buy-license');
        if(btnDisplay) btnDisplay.innerText = "Obtener Licencia";
    }
}

initLanding();

// ==========================================
// 2. UTILIDADES UI
// ==========================================
window.switchPayment = (type) => {
    const secBs = document.getElementById('section-bs');
    const secUsd = document.getElementById('section-usd');
    const formBs = document.getElementById('saas-form-bs'); // Nuevo ID
    const formUsd = document.getElementById('saas-form-usd'); // Nuevo ID
    
    const tabBs = document.getElementById('tab-bs');
    const tabUsd = document.getElementById('tab-usd');

    if (type === 'bs') {
        // Mostrar Bs
        secBs.classList.remove('hidden');
        formBs.classList.remove('hidden');
        formBs.classList.add('flex'); // Para centrado vertical
        
        // Ocultar USD
        secUsd.classList.add('hidden');
        formUsd.classList.add('hidden');
        formUsd.classList.remove('flex');

        // Estilos Tabs
        tabBs.className = "flex-1 py-2.5 text-xs font-bold rounded-lg bg-primary text-background-dark shadow-lg transition-all";
        tabUsd.className = "flex-1 py-2.5 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition-all";
    } else {
        // Mostrar USD
        secBs.classList.add('hidden');
        formBs.classList.add('hidden');
        formBs.classList.remove('flex');

        secUsd.classList.remove('hidden');
        formUsd.classList.remove('hidden');
        formUsd.classList.add('flex');

        // Estilos Tabs
        tabUsd.className = "flex-1 py-2.5 text-xs font-bold rounded-lg bg-blue-500 text-white shadow-lg transition-all";
        tabBs.className = "flex-1 py-2.5 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition-all";
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
// 3. MODAL Y FORMULARIO (CORREGIDO)
// ==========================================
const modal = document.getElementById('purchase-modal');
const saasForm = document.getElementById('saas-form'); // <--- BUSCAMOS EL ID


window.openPurchaseModal = () => { 
    if(modal) {
        modal.classList.remove('hidden');
        if (typeof USER_COUNTRY !== 'undefined' && USER_COUNTRY !== 'VE') switchPayment('usd');
    }
};

window.closePurchaseModal = () => { if(modal) modal.classList.add('hidden'); };

const dateInput = document.getElementById('payment-date');
if (dateInput) {
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localIso;
}

// 4. ENVÍO PAGO MÓVIL (LÓGICA BLINDADA)
// 4. ENVÍO PAGO MÓVIL
const saasFormBs = document.getElementById('saas-form-bs');

if (saasFormBs) {
    saasFormBs.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = saasFormBs.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        
        btn.innerText = "Verificando..."; 
        btn.disabled = true;

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

        await sendPurchase(data, btn, originalText);
    });
} else {
    console.warn("⚠️ Formulario Pago Móvil no detectado en esta vista.");
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
// ==========================================
// 6. FUNCIÓN DE ENVÍO (VERSIÓN FINAL)
// ==========================================
async function sendPurchase(data, btn, originalText) {
    // 1. Definir elementos del DOM que usaremos al finalizar
    const successModal = document.getElementById('saas-success-modal');
    const emailDisplay = document.getElementById('success-email-display');
    const goBtn = document.getElementById('btn-go-dashboard');

    try {
        console.log("📤 Enviando datos de compra...", data);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Intentamos obtener la respuesta del servidor
        const result = await response.json();

        if (response.ok) {
            console.log("✅ Compra procesada con éxito:", result);

            // A. Cerrar el modal de formulario
            closePurchaseModal();
            
            // B. Configurar el modal de éxito con los datos recibidos
            if (emailDisplay) {
                emailDisplay.innerText = data.buyerData.email;
            }
            
            // C. Determinar la URL de redirección (prioridad a la que envíe el servidor)
            const finalUrl = result.redirectUrl || '/index.html';

            // D. Configurar el botón de acción del modal de éxito
            if (goBtn) {
                goBtn.onclick = () => {
                    window.location.href = finalUrl;
                };
            }

            // E. Mostrar el modal de éxito (Premium)
            if (successModal) {
                successModal.classList.remove('hidden');
            }

            // F. Redirección automática de respaldo tras 10 segundos
            setTimeout(() => {
                if (window.location.pathname !== finalUrl) {
                    window.location.href = finalUrl;
                }
            }, 10000);

        } else {
            // Manejo de errores del servidor (402, 400, 500, etc.)
            console.error("❌ Error del servidor:", result);
            alert("⚠️ Error: " + (result.message || result.error || "No se pudo validar el pago. Verifica los datos."));
            
            // Restaurar el botón para que el usuario pueda intentar corregir
            if (btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    } catch (error) {
        // Errores de red o de código local
        console.error("🚨 Error crítico en sendPurchase:", error);
        alert("Error de conexión: No se pudo contactar con el servidor. Intenta de nuevo.");
        
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}