// ==========================================
// CONFIGURACIÓN
// ==========================================
// const BASE_API = "https://rifa-carros-corolla.onrender.com/api"; // Producción
const BASE_API = "http://localhost:3000/api"; // Local

const API_BUY = `${BASE_API}/saas/buy`;
const API_CONFIG = `${BASE_API}/master/config`;
const API_RATE = `${BASE_API}/tasa`;

let SOFTWARE_PRICE_USD = 50; 
let EXCHANGE_RATE = 0;
let SOFTWARE_PRICE_VES = 0;

// ==========================================
// 1. CARGAR DATOS (PRECIO + TASA)
// ==========================================
async function initLanding() {
    try {
        // Ejecutamos ambas peticiones en paralelo para que sea rápido
        const [configRes, rateRes] = await Promise.all([
            fetch(API_CONFIG),
            fetch(API_RATE)
        ]);

        const configData = await configRes.json();
        const rateData = await rateRes.json();

        // 1. Establecer Precio USD
        if (configData.softwarePrice) {
            SOFTWARE_PRICE_USD = parseFloat(configData.softwarePrice);
        }

        // 2. Establecer Tasa
        if (rateData.rate) {
            EXCHANGE_RATE = parseFloat(rateData.rate);
        }

        // 3. Calcular Bolívares
        SOFTWARE_PRICE_VES = SOFTWARE_PRICE_USD * EXCHANGE_RATE;
        const vesFormatted = SOFTWARE_PRICE_VES.toFixed(2);

        console.log(`Precio: $${SOFTWARE_PRICE_USD} | Tasa: ${EXCHANGE_RATE} | Bs: ${vesFormatted}`);

        // --- ACTUALIZAR INTERFAZ ---

        // A. Botón Grande (Header)
        const btnDisplay = document.getElementById('btn-buy-license');
        if (btnDisplay) {
            btnDisplay.innerHTML = `
                Obtener Licencia <br>
                <span class="text-sm font-normal">$${SOFTWARE_PRICE_USD} (Bs. ${vesFormatted})</span>
            `;
        }

        // B. Monto en el Formulario (Modal)
        const modalPrice = document.getElementById('display-saas-price');
        if (modalPrice) {
            modalPrice.innerHTML = `$${SOFTWARE_PRICE_USD} <span class="text-sm text-gray-400">/ Bs. ${vesFormatted}</span>`;
        }

        // C. Actualizar Botón de Copiar (Copia los Bs. para facilitar el pago)
        const copyPriceBtn = document.getElementById('btn-copy-price');
        if (copyPriceBtn) {
            copyPriceBtn.onclick = function() {
                // Copiamos el monto en Bolívares que es lo que el banco pide
                copyText(vesFormatted, this);
            };
        }

    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// Iniciar al cargar
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

// Función especial para copiar TODO el bloque
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
        btn.innerText = "Validando...";
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
            amount: SOFTWARE_PRICE_USD // Enviamos USD, el backend convierte
        };

        try {
            const response = await fetch(API_BUY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                btn.className = "w-full bg-green-500 text-white font-bold py-4 rounded-xl";
                btn.innerText = "¡ACTIVADO!";
                alert("¡Compra exitosa! Bienvenido.");
                window.location.href = result.redirectUrl;
            } else {
                // Mostrar el monto esperado en el error para ayudar al usuario
                const errorMsg = result.error.includes("Pago no encontrado") 
                    ? `Pago no encontrado.\nVerifica que hayas transferido Bs. ${SOFTWARE_PRICE_VES.toFixed(2)}`
                    : result.error;
                    
                alert("❌ " + errorMsg);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}