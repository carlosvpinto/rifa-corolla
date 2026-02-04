// ==========================================
// CONFIGURACIÓN (LOCAL / PROD)
// ==========================================
// ⚠️ URL DE PRODUCCIÓN (Render) - DESCOMENTAR AL SUBIR
// const API_URL = "https://rifa-carros-corolla.onrender.com/api/saas/buy";
// const MASTER_CONFIG_URL = "https://rifa-carros-corolla.onrender.com/api/master/config";
// const API_RATE = "https://rifa-carros-corolla.onrender.com/api/tasa";

// ⚠️ URL LOCAL (Para pruebas)
const API_URL = "http://localhost:3000/api/saas/buy";
const MASTER_CONFIG_URL = "http://localhost:3000/api/master/config";
const API_RATE = "http://localhost:3000/api/tasa";

// VARIABLES GLOBALES (Definidas aquí para evitar ReferenceError)
let SOFTWARE_PRICE_USD = 50; 
let EXCHANGE_RATE = 0;
let SOFTWARE_PRICE_VES = 0;

// ==========================================
// 1. CARGAR PRECIO Y TASA
// ==========================================
async function initLanding() {
    try {
        console.log("Cargando precios...");
        
        // Cargar Configuración y Tasa en paralelo
        const [configRes, rateRes] = await Promise.all([
            fetch(MASTER_CONFIG_URL),
            fetch(API_RATE)
        ]);

        const configData = await configRes.json();
        const rateData = await rateRes.json();

        // 1. Precio USD
        if (configData.softwarePrice) {
            SOFTWARE_PRICE_USD = parseFloat(configData.softwarePrice);
        }

        // 2. Tasa BCV
        if (rateData.rate) {
            EXCHANGE_RATE = parseFloat(rateData.rate);
        } else {
            EXCHANGE_RATE = 60; // Fallback
        }

        // 3. Calcular Bs
        SOFTWARE_PRICE_VES = SOFTWARE_PRICE_USD * EXCHANGE_RATE;
        const vesFormatted = SOFTWARE_PRICE_VES.toFixed(2);

        console.log(`Precio: $${SOFTWARE_PRICE_USD} | Tasa: ${EXCHANGE_RATE}`);

        // --- ACTUALIZAR UI ---

        // A. Botón Principal (Hero)
        const btnDisplay = document.getElementById('btn-buy-license');
        if (btnDisplay) {
            btnDisplay.innerHTML = `
                Obtener Licencia por $${SOFTWARE_PRICE_USD}<br>
                <span class="text-sm font-normal text-green-200">Bs. ${vesFormatted}</span>
            `;
        }

        // B. Precio Grande (Sección Demo)
        const bigPrice = document.getElementById('display-price-big');
        if (bigPrice) bigPrice.innerText = `$${SOFTWARE_PRICE_USD}`;

        // C. Monto en el Modal
        const modalPrice = document.getElementById('display-saas-price');
        if (modalPrice) {
            modalPrice.innerHTML = `$${SOFTWARE_PRICE_USD} <span class="text-sm text-gray-400">/ Bs. ${vesFormatted}</span>`;
        }

        // D. Botón Copiar Precio
        const copyPriceBtn = document.getElementById('btn-copy-price');
        if (copyPriceBtn) {
            copyPriceBtn.onclick = function() { copyText(vesFormatted, this); };
        }

    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

initLanding();

// ==========================================
// 2. UTILIDADES UI
// ==========================================
window.copyText = (text, btnElement) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="material-symbols-outlined text-green-400 font-bold">check</span>`;
        setTimeout(() => btnElement.innerHTML = originalContent, 2000);
    });
};

window.copyAllSaasData = (btnElement) => {
    const textToCopy = `
Banco: Mercantil (0105)
Teléfono: 0424-345-4032
RIF: J-506818817
Monto: Bs. ${SOFTWARE_PRICE_VES.toFixed(2)} ($${SOFTWARE_PRICE_USD})
`.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="material-symbols-outlined text-green-400">check_circle</span> Copiado`;
        btnElement.classList.add('border-green-500/50', 'text-green-400');
        setTimeout(() => {
            btnElement.innerHTML = originalContent;
            btnElement.classList.remove('border-green-500/50', 'text-green-400');
        }, 2000);
    });
};

// ==========================================
// 3. MODAL Y FORMULARIO
// ==========================================
const modal = document.getElementById('purchase-modal');
window.openPurchaseModal = () => { if(modal) modal.classList.remove('hidden'); };
window.closePurchaseModal = () => { if(modal) modal.classList.add('hidden'); };

const dateInput = document.getElementById('payment-date');
if (dateInput) {
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localIso;
}

const saasForm = document.getElementById('saas-form');
if (saasForm) {
    saasForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "Verificando Pago...";
        btn.disabled = true;

        const data = {
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
            amount: SOFTWARE_PRICE_USD // Enviamos USD
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                btn.className = "w-full bg-green-500 text-white font-bold py-4 rounded-xl";
                btn.innerText = "¡ACTIVADO!";
                alert("¡Felicidades! Tu software ha sido creado. Redirigiendo a tu nuevo panel.");
                window.location.href = result.redirectUrl;
            } else {
                alert("❌ " + (result.error || "Pago no verificado."));
                btn.innerText = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión. Asegúrate que el servidor esté encendido.");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}