// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE Y STORAGE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const db = getFirestore(app);
const storage = getStorage(app);



// LISTA DE BANCOS VENEZUELA (OFICIAL SUDEBAN)
const VENEZUELA_BANKS = [
    { code: "0156", name: "100% Banco" },
    { code: "0196", name: "ABN Amro Bank" },
    { code: "0172", name: "Bancamiga" },
    { code: "0171", name: "Banco Activo" },
    { code: "0166", name: "Banco Agrícola" },
    { code: "0175", name: "Banco Bicentenario" },
    { code: "0128", name: "Banco Caroní" },
    { code: "0164", name: "Banco de Desarrollo" },
    { code: "0102", name: "Banco de Venezuela" },
    { code: "0114", name: "Bancaribe" },
    { code: "0163", name: "Banco del Tesoro" },
    { code: "0115", name: "Banco Exterior" },
    { code: "0003", name: "Banco Industrial" },
    { code: "0173", name: "Banco Internacional de Desarrollo" },
    { code: "0105", name: "Banco Mercantil" },
    { code: "0191", name: "Banco Nacional de Crédito (BNC)" },
    { code: "0116", name: "Banco Occidental de Descuento (BOD)" },
    { code: "0138", name: "Banco Plaza" },
    { code: "0108", name: "Banco Provincial" },
    { code: "0104", name: "Banco Venezolano de Crédito" },
    { code: "0168", name: "Bancrecer" },
    { code: "0134", name: "Banesco" },
    { code: "0177", name: "Banfanb" },
    { code: "0146", name: "Bangente" },
    { code: "0174", name: "Banplus" },
    { code: "0190", name: "Citibank" },
    { code: "0121", name: "Corp Banca" },
    { code: "0157", name: "Delsur" },
    { code: "0151", name: "Fondo Común (BFC)" },
    { code: "0601", name: "Instituto Municipal de Crédito" },
    { code: "0169", name: "Mi Banco" },
    { code: "0137", name: "Sofitasa" }
];

// Referencias Nuevas
const bankSelect = document.getElementById('bank-name-select');
// const bankCodeInput = document.getElementById('bank-code-input'); // Ya la tenías, asegúrate de tenerla

// FUNCIÓN PARA LLENAR EL SELECT
function initBankSelector() {
    if(!bankSelect) return;
    
    // Limpiar y ordenar alfabéticamente
    bankSelect.innerHTML = '<option value="" disabled selected>Selecciona un Banco</option>';
    VENEZUELA_BANKS.sort((a, b) => a.name.localeCompare(b.name));

    VENEZUELA_BANKS.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.code; // El valor del option será el CÓDIGO
        option.text = bank.name;
        bankSelect.appendChild(option);
    });

    // Evento: Al cambiar el banco, poner el código
    bankSelect.addEventListener('change', () => {
        if(bankCodeInput) bankCodeInput.value = bankSelect.value;
    });
}

// Inicializar al cargar el script
initBankSelector();

// ==========================================
// 2. UI HELPERS
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('admin-toast');
    const title = document.getElementById('toast-title');
    const msg = document.getElementById('toast-message');
    const icon = document.getElementById('toast-icon');
    const border = toast; 

    if (type === 'success') {
        title.innerText = "¡Éxito!";
        icon.innerText = "check_circle";
        icon.className = "material-symbols-outlined text-primary";
        border.classList.remove('border-red-500'); border.classList.add('border-primary');
    } else {
        title.innerText = "Error";
        icon.innerText = "error";
        icon.className = "material-symbols-outlined text-red-500";
        border.classList.remove('border-primary'); border.classList.add('border-red-500');
    }
    msg.innerText = message;
    toast.classList.remove('translate-x-full', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); }, 3500);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const card = document.getElementById('confirm-card');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-desc').innerText = message;
        
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); card.classList.remove('scale-95'); card.classList.add('scale-100'); }, 10);

        const close = (result) => {
            modal.classList.add('opacity-0'); card.classList.remove('scale-100'); card.classList.add('scale-95');
            setTimeout(() => { modal.classList.add('hidden'); resolve(result); }, 300);
        };
        
        // Clonar botones para limpiar eventos viejos
        const btnYes = document.getElementById('btn-confirm');
        const btnNo = document.getElementById('btn-cancel');
        const newYes = btnYes.cloneNode(true);
        const newNo = btnNo.cloneNode(true);
        btnYes.parentNode.replaceChild(newYes, btnYes);
        btnNo.parentNode.replaceChild(newNo, btnNo);

        newYes.onclick = () => close(true);
        newNo.onclick = () => close(false);
    });
}

// ==========================================
// 3. VARIABLES GLOBALES Y LOGIN
// ==========================================
// ⚠️ URL DE PRODUCCIÓN (O LOCAL)
// const API_BASE_URL = "http://localhost:3000/api"; 
const API_BASE_URL = "https://vendeturifa.com/api"; 

// OBTENER ID DEL CLIENTE DE LA URL
const urlParams = new URLSearchParams(window.location.search);

const CLIENT_ID = urlParams.get('id') || 'demo';
const CLIENT_API_URL = `${API_BASE_URL}/${CLIENT_ID}`;

// --- CORRECCIÓN SAAS: VINCULAR BRANDING CON ID ---
const brandingLink = document.getElementById('branding-link');
if (brandingLink) {
    brandingLink.href = `branding.html?id=${CLIENT_ID}`;
}

window.CURRENT_POOL_SIZE = 100;
window.CURRENT_PRICE = 5;
window.CURRENT_CURRENCY = '$';
let existingUrls = [];    
let newFilesToUpload = [];

const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const pinInput = document.getElementById('admin-pin');
const loginError = document.getElementById('login-error');

// Auto-login
if (sessionStorage.getItem(`admin_auth_${CLIENT_ID}`) === 'true') showDashboard();

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputPin = pinInput.value;
    const btn = loginForm.querySelector('button');
    const originalText = btn.innerText;
    
    btn.innerText = "Verificando..."; btn.disabled = true;
    loginError.classList.add('hidden');

    try {
        const response = await fetch(`${CLIENT_API_URL}/admin/login`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: inputPin })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            sessionStorage.setItem(`admin_auth_${CLIENT_ID}`, 'true');
            showDashboard();
        } else {
            loginError.classList.remove('hidden');
            showToast("PIN Incorrecto", 'error');
            pinInput.value = '';
        }
    } catch (error) { showToast("Error de conexión", 'error'); } 
    finally { btn.innerText = originalText; btn.disabled = false; }
});

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
    loadConfig(); 
}

window.logout = () => { sessionStorage.removeItem(`admin_auth_${CLIENT_ID}`); location.reload(); };
window.refreshData = async () => {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    await loadConfig(); 
    if(icon) setTimeout(() => icon.classList.remove('animate-spin'), 500);
    showToast("Datos actualizados");
};

// ==========================================
// 4. LÓGICA DE MENÚ Y MODALS
// ==========================================
window.toggleMenu = () => {
    const menu = document.getElementById('dropdown-menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        setTimeout(() => { menu.classList.remove('opacity-0', 'scale-95'); menu.classList.add('opacity-100', 'scale-100'); }, 10);
    } else { closeMenu(); }
};

function closeMenu() {
    const menu = document.getElementById('dropdown-menu');
    menu.classList.remove('opacity-100', 'scale-100'); menu.classList.add('opacity-0', 'scale-95');
    setTimeout(() => menu.classList.add('hidden'), 200);
}

document.addEventListener('click', (e) => {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('dropdown-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) closeMenu();
});

// Modales
window.openSettingsModal = () => {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
    closeMenu();
};
window.closeSettingsModal = () => { document.getElementById('settings-modal').classList.add('hidden'); };

window.openSecurityModal = () => {
    const modal = document.getElementById('security-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    closeMenu();
};
window.closeSecurityModal = () => {
    const modal = document.getElementById('security-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// ==========================================
// 5. CONFIGURACIÓN GENERAL
// ==========================================
// REFERENCIAS A LOS INPUTS DEL HTML
const ticketsSelect = document.getElementById('total-tickets-select');
const priceInput = document.getElementById('ticket-price-input');
const currencySelect = document.getElementById('currency-select');
const manualSoldInput = document.getElementById('manual-sold-input'); 
const statusToggle = document.getElementById('raffle-status-toggle');
const statusLabel = document.getElementById('status-label');
const titleInput = document.getElementById('raffle-title-input'); 
const codeInput = document.getElementById('draw-code-input');
const verificationToggle = document.getElementById('verification-mode-toggle');
const verificationLabel = document.getElementById('verification-label');

const bankNameInput = document.getElementById('bank-name-input');
const bankCodeInput = document.getElementById('bank-code-input');
const paymentPhoneInput = document.getElementById('payment-phone-input');
const paymentCIInput = document.getElementById('payment-ci-input');

// 🔴 AGREGAMOS LAS REFERENCIAS QUE FALTABAN AQUÍ:
const binanceInput = document.getElementById('binance-email-input');
const zelleInput = document.getElementById('zelle-email-input');

const descriptionInput = document.getElementById('raffle-description-input'); 

// Eventos visuales switches
// LÓGICA DEL SWICH DE ESTADO (CON ADVERTENCIA DE CIERRE)
if(statusToggle) {
    statusToggle.addEventListener('change', async (e) => {
        
        // CASO 1: El usuario intenta CERRAR la rifa (Desmarcar el switch)
        if (!statusToggle.checked) {
            
            // Mostrar advertencia
            const confirmClose = await showConfirm(
                "⚠️ ¿Detener Ventas?",
                "Al cerrar la rifa, los usuarios NO podrán comprar más tickets y la plataforma mostrará 'Ventas Cerradas'. ¿Estás seguro?"
            );

            // Si el usuario CANCELA (dice que no)
            if (!confirmClose) {
                // Volvemos a encender el switch (cancelar la acción visualmente)
                statusToggle.checked = true;
                updateStatusUI(); 
                return; // Salimos sin hacer nada más
            }
        }

        // CASO 2: Si confirmó el cierre O si está abriendo la rifa
        updateStatusUI();
    });
}

// Función auxiliar para actualizar texto y color (ABIERTO/CERRADO)
function updateStatusUI() {
    if (statusToggle.checked) {
        statusLabel.innerText = "ABIERTO";
        statusLabel.className = "ml-3 text-xs font-bold text-primary tracking-wider";
    } else {
        statusLabel.innerText = "CERRADO";
        statusLabel.className = "ml-3 text-xs font-bold text-gray-400 tracking-wider";
    }
}
// LÓGICA DEL SWICH DE VERIFICACIÓN (CON ADVERTENCIA DE API)
if(verificationToggle) {
    verificationToggle.addEventListener('change', async (e) => {
        
        // Verificamos si el usuario lo está ENCENDIENDO (pasando a Automático)
        if (verificationToggle.checked) {
            
            // 1. Mostrar advertencia usando tu modal de confirmación existente
            const userConfirmed = await showConfirm(
                "⚠️ Requisito Técnico",
                "La validación automática requiere conexión a una API Bancaria. Si no tienes una configurada, los pagos no se conciliarán. ¿Deseas activarlo de todas formas?"
            );

            // 2. Si el usuario cancela o cierra el modal
            if (!userConfirmed) {
                // Devolvemos el switch a apagado (Manual)
                verificationToggle.checked = false;
                updateVerificationUI(false); 
                return; // Salimos de la función
            }
        }

        // 3. Si aceptó (o si lo está apagando), actualizamos la interfaz visual
        updateVerificationUI(verificationToggle.checked);
    });
}

// Función auxiliar para actualizar el texto y color del label
function updateVerificationUI(isChecked) {
    if (isChecked) {
        verificationLabel.innerText = "AUTOMÁTICO";
        verificationLabel.className = "ml-3 text-xs font-bold text-blue-400 tracking-wider";
    } else {
        verificationLabel.innerText = "MANUAL";
        verificationLabel.className = "ml-3 text-xs font-bold text-orange-400 tracking-wider";
    }
}

// CARGAR CONFIGURACIÓN DESDE EL SERVIDOR
async function loadConfig() {
    try {
        const response = await fetch(`${CLIENT_API_URL}/config`);
        const data = await response.json();
        
        if (data.totalTickets) {

             if (bankSelect && data.bankCode) {
                bankSelect.value = data.bankCode; 
            }
            if (bankCodeInput) bankCodeInput.value = data.bankCode || "0105";

            // Rellenar Campos Numéricos
            if(ticketsSelect) ticketsSelect.value = data.totalTickets;
            if(priceInput) priceInput.value = data.ticketPrice;
            if(currencySelect) currencySelect.value = data.currency;
            if(manualSoldInput) manualSoldInput.value = data.manualSold || 0;
            
            // Rellenar Campos de Texto
            if(titleInput) titleInput.value = data.raffleTitle || "";
            if(codeInput) codeInput.value = data.drawCode || "";

             // 🔴 CARGAR DESCRIPCIÓN
            if(descriptionInput) descriptionInput.value = data.raffleDescription || "";

            // Switch Estado
            if(statusToggle) {
                statusToggle.checked = !data.isClosed; 
                statusToggle.dispatchEvent(new Event('change'));
            }

            if(descriptionInput) descriptionInput.value = data.raffleDescription || "";

            // Switch Verificación
            if(verificationToggle) {
                verificationToggle.checked = data.verificationMode !== 'manual';
                verificationToggle.dispatchEvent(new Event('change'));
            }

            // Imágenes
             if (data.images && Array.isArray(data.images)) {
                existingUrls = data.images;
                renderPreviews(); 
            }

            // Banco Pago Móvil
            if(bankNameInput) bankNameInput.value = data.bankName || "Mercantil";
            if(bankCodeInput) bankCodeInput.value = data.bankCode || "0105";
            if(paymentPhoneInput) paymentPhoneInput.value = data.paymentPhone || "04141234567";
            if(paymentCIInput) paymentCIInput.value = data.paymentCI || "J-123456789";

            // 🔴 CARGAR BINANCE Y ZELLE (SI EXISTEN LOS INPUTS)
            if(binanceInput) binanceInput.value = data.binanceEmail || "";
            if(zelleInput) zelleInput.value = data.zelleEmail || "";

            // Actualizar variables globales
            window.CURRENT_POOL_SIZE = parseInt(data.totalTickets);
            window.CURRENT_PRICE = parseFloat(data.ticketPrice);
            window.CURRENT_CURRENCY = data.currency;

         // Bloque de Aviso DEMO
    if (typeof CLIENT_ID !== 'undefined' && CLIENT_ID === 'demo-pro') {
        const banner = document.createElement('div');
        
        // 🔴 CORRECCIÓN: Cambiamos 'fixed top-0' por 'relative'
        banner.className = "relative w-full bg-orange-600 text-white text-center text-xs font-bold py-1 z-[200] shadow-lg";
        
        banner.innerHTML = "🔧 MODO DEMOSTRACIÓN PÚBLICA - Los datos se reinician cada 24h - No usar para ventas reales";
        document.body.prepend(banner);
    }
            
            // Cargar tabla de ventas
            loadData();
        }
    } catch (error) { console.error(error); }
}

// GUARDAR CONFIGURACIÓN GENERAL
// 🔴 FUNCIÓN UNIFICADA: SUBIR IMÁGENES + GUARDAR DATOS 🔴
window.saveConfig = async () => {
    // 1. RECOPILAR DATOS DEL FORMULARIO
    const newTotal = ticketsSelect.value;
    const newPrice = priceInput.value;
    const newCurrency = currencySelect.value;
    const newManualSold = manualSoldInput.value; 
    const isRaffleOpen = statusToggle.checked; // Si está check, está ABIERTO
    const newTitle = titleInput.value;
    const newCode = codeInput.value;
    const newDesc = descriptionInput.value; // <--- Obtener valor

    
    
    // Datos Bancarios
 
     const bankName = bankSelect.options[bankSelect.selectedIndex]?.text || "Mercantil";
    const bankCode = bankSelect.value || "0105"; // El valor del select es el código
    
    const payPhone = paymentPhoneInput.value;
    const payCI = paymentCIInput.value;

    // Datos Binance/Zelle (Usa ? para evitar error si no existen los inputs)
    const valBinance = binanceInput ? binanceInput.value : "";
    const valZelle = zelleInput ? zelleInput.value : "";

    // Modo de Verificación
    const isAutoVerification = verificationToggle.checked;
    const modeToSend = isAutoVerification ? 'auto' : 'manual';

    // 2. CONFIRMACIÓN
    if (!await showConfirm("¿Guardar cambios?", "Se actualizará la configuración y se subirán las nuevas imágenes.")) return;

    // Bloquear botón
    const btn = document.querySelector('button[onclick="saveConfig()"]');
    const originalText = btn.innerText;
    btn.innerText = "Procesando..."; 
    btn.disabled = true;

    try {
        // 3. LÓGICA DE IMÁGENES (Subida a Storage)
        let uploadedUrls = [];
        
        // Si hay archivos nuevos seleccionados, los subimos uno por uno
        if (newFilesToUpload.length > 0) {
            btn.innerText = `Subiendo ${newFilesToUpload.length} fotos...`;
            
            for (const file of newFilesToUpload) {
                // Referencia: tenants/ID_CLIENTE/slides/FECHA_NOMBRE
                const storageRef = ref(storage, `tenants/${CLIENT_ID}/slides/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                uploadedUrls.push(url);
            }
        }

        // Combinar URLs viejas (existingUrls) con las nuevas (uploadedUrls)
        const finalImageList = [...existingUrls, ...uploadedUrls];

        // 4. ENVIAR TODO AL SERVIDOR
        btn.innerText = "Guardando datos...";

        const response = await fetch(`${CLIENT_API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                // Configuración General
                totalTickets: newTotal, 
                ticketPrice: newPrice, 
                currency: newCurrency, 
                manualSold: newManualSold,
                isClosed: !isRaffleOpen, // isClosed es true si el switch está apagado
                raffleTitle: newTitle, 
                drawCode: newCode, 
                verificationMode: modeToSend,
                
                // Configuración Bancaria
                bankName, bankCode, paymentPhone: payPhone, paymentCI: payCI,
                binanceEmail: valBinance, zelleEmail: valZelle,
                
                // Galería de Imágenes (Array de URLs)
                images: finalImageList ,
                raffleDescription: newDesc // <--- Enviar Descrpcion al servidor
            })
        });

        if (response.ok) {
            showToast("✅ Configuración y Galería Guardadas Exitosamente");
            
            // Limpiar la cola de subida porque ya se guardaron
            newFilesToUpload = []; 
            
            // Recargar la configuración para ver los cambios reflejados
            loadConfig(); 
        } else { 
            const result = await response.json();
            showToast(result.error || "Error del servidor al guardar", 'error'); 
        }

    } catch (error) { 
        console.error(error);
        showToast("Error de conexión o subida: " + error.message, 'error'); 
    } finally { 
        // Restaurar botón
        btn.innerText = originalText; 
        btn.disabled = false; 
    }
};

// Guardar nuevo PIN
window.saveNewPin = async () => {
    const newPin = document.getElementById('new-admin-pin').value;
    if(!newPin) return showToast("Escribe un PIN", 'error');
    if(!await showConfirm("¿Cambiar PIN?", "Deberás usar el nuevo PIN.")) return;

    try {
        const response = await fetch(`${CLIENT_API_URL}/config`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPin: newPin })
        });
        if(response.ok) { showToast("PIN actualizado"); closeSecurityModal(); }
        else showToast("Error al guardar", 'error');
    } catch (e) { showToast("Error", 'error'); }
};

// ==========================================
// 6. VENTAS Y TABLA
// ==========================================
let allSales = []; 

async function loadData() {
    const tableBody = document.getElementById('sales-table-body');
    try {
        // En SaaS, la colección de ventas es una subcolección dentro del documento del cliente
        // Como estamos en el cliente, no podemos acceder a 'raffles/ID/sales' directamente desde aquí si las reglas de seguridad
        // no están configuradas para ello. 
        // PERO: Si estamos usando el SDK de Admin en el server, está bien.
        // SI USAMOS CLIENT SDK EN FRONT: Necesitamos que el servidor nos de los datos o tener permisos de lectura.
        // NOTA: Para este admin.js, lo ideal es crear un endpoint en el backend /api/:id/sales
        // Pero como estamos usando Firebase directo aqui, debemos construir la query correcta.
        
        // CORRECCIÓN SAAS: Buscar en raffles -> ID -> sales
        const salesRef = collection(db, "raffles", CLIENT_ID, "sales");
        const q = query(salesRef);
        const querySnapshot = await getDocs(q);
        
        allSales = [];
        let totalMoney = 0; let totalTickets = 0;

        querySnapshot.forEach((doc) => {
            const rawData = doc.data();
            let qty = rawData.ticketsQty || 0;
            if (!qty && rawData.numbers) qty = rawData.numbers.length;
            let amount = rawData.totalAmount || (qty * window.CURRENT_PRICE);
            
            allSales.push({
                id: doc.id, ...rawData, ticketsQty: qty, totalAmount: amount, 
                currency: rawData.currency || window.CURRENT_CURRENCY,
                dateObj: rawData.purchaseDate || rawData.date || null
            });
            totalMoney += amount; totalTickets += qty;
        });

        allSales.sort((a, b) => (b.dateObj?.seconds || 0) - (a.dateObj?.seconds || 0));

        // Actualizar tarjetas
        const availableTickets = window.CURRENT_POOL_SIZE - totalTickets;
        const CURRENCY_SYMBOL = window.CURRENT_CURRENCY || '$';
        document.getElementById('stat-available').innerText = availableTickets;
        document.getElementById('stat-money').innerText = CURRENCY_SYMBOL + " " + totalMoney.toFixed(2); 
        document.getElementById('stat-tickets').innerText = totalTickets;
        document.getElementById('stat-clients').innerText = allSales.length;

        renderTable(allSales);
    } catch (error) { console.error(error); }
}

function renderTable(data) {
    const tableBody = document.getElementById('sales-table-body');
    if(!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">Sin ventas registradas.</td></tr>';
        return;
    }

    data.forEach(sale => {
        // 1. Formateo de Fecha
        let dateStr = "N/A";
        if (sale.dateObj && sale.dateObj.toDate) {
            dateStr = sale.dateObj.toDate().toLocaleDateString('es-VE', { 
                month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' 
            });
        }
        const saleCurrency = sale.currency || window.CURRENT_CURRENCY;

        // 2. Lógica de Iconos de Pago (Binance/Zelle/PM)
        let methodIcon = '';
        if (sale.paymentMethod === 'binance') methodIcon = '<span class="text-yellow-400 font-bold text-[9px] mr-1">BINANCE</span>';
        else if (sale.paymentMethod === 'zelle') methodIcon = '<span class="text-purple-400 font-bold text-[9px] mr-1">ZELLE</span>';
        else methodIcon = '<span class="text-blue-400 font-bold text-[9px] mr-1">PAGO MÓVIL</span>';

        // 3. Botón de Ver Recibo (Si existe URL)
        let receiptBtn = '';
        if (sale.receiptUrl) {
            receiptBtn = `
                <button onclick="viewReceipt('${sale.receiptUrl}')" class="text-gray-400 hover:text-white ml-1 transition-colors" title="Ver Comprobante">
                    <span class="material-symbols-outlined text-[16px] align-middle">image</span>
                </button>
            `;
        }

        // 4. Lógica de Estado (Pendiente vs Listo)
        const isPending = sale.verificationMethod === 'manual';
        let statusIcon;

        if (isPending) {
            // Botón para validar manualmente
            statusIcon = `
                <button onclick="approveSale('${sale.id}', '${sale.name}')" 
                        class="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 group border border-orange-500/20 ml-auto mt-1"
                        title="Click para confirmar el pago">
                    <span class="material-symbols-outlined text-[16px]">pending_actions</span>
                    <span class="text-[10px] font-bold uppercase group-hover:underline">Validar</span>
                </button>
            `;
        } else {
            // Estado verificado
            statusIcon = `
                <div class="flex items-center justify-end gap-1 text-primary mt-1 opacity-80">
                    <span class="text-[10px] font-bold uppercase tracking-wider">Listo</span>
                    <span class="material-symbols-outlined text-[18px]">verified</span>
                </div>
            `;
        }

        const row = document.createElement('tr');
        row.className = "hover:bg-white/5 transition-colors border-b border-white/5";
        
        row.innerHTML = `
            <!-- Fecha (Solo PC) -->
            <td class="p-3 text-gray-400 text-[10px] hidden sm:table-cell whitespace-nowrap align-top">
                ${dateStr}
            </td>
            
            <!-- Cliente -->
            <td class="p-3 align-top">
                <div class="font-bold text-white text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">
                    ${sale.name}
                </div>
                <div class="text-[10px] text-primary sm:hidden">
                    ${sale.ci}
                </div>
            </td>

            <!-- Referencia + Método + Recibo -->
            <td class="p-3 align-top">
                <div class="flex flex-col items-start">
                    <span class="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px] tracking-wider">
                        ${sale.ref}
                    </span>
                    <div class="mt-1 flex items-center">
                        ${methodIcon}
                        ${receiptBtn}
                    </div>
                </div>
            </td>

            <!-- Contacto (Solo PC) -->
            <td class="p-3 text-gray-400 text-xs hidden sm:table-cell align-top">
                <span class="text-primary font-bold">${sale.ci}</span><br>
                ${sale.phone}
            </td>

            <!-- Tickets (Scroll en Móvil, Wrap en PC) -->
            <td class="p-3 max-w-[120px] sm:max-w-none align-top">
                <div class="flex gap-1 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-1">
                    ${sale.numbers.map(n => `
                        <span class="bg-surface-highlight border border-white/10 text-white px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex-shrink-0">
                            ${n}
                        </span>
                    `).join('')}
                </div>
            </td>

            <!-- Monto + Acción -->
            <td class="p-3 text-right align-top">
                <div class="font-bold text-green-400 text-xs sm:text-sm whitespace-nowrap">
                     ${sale.totalAmount.toFixed(2)} ${saleCurrency}
                </div>
                ${statusIcon}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// ==========================================
// 7. APROBACIÓN MANUAL
// ==========================================
window.approveSale = async (saleId, clientName) => {
    if (!await showConfirm("¿Aprobar Pago?", `Confirmar pago de ${clientName}.`)) return;
    showToast("Procesando...", 'success');

    try {
        const response = await fetch(`${CLIENT_API_URL}/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saleId: saleId })
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`✅ Pago de ${clientName} aprobado`);
            loadData();
        } else { showToast(result.error || "Error", 'error'); }
    } catch (e) { showToast("Error de conexión", 'error'); }
};

// ==========================================
// 8. IMÁGENES
// ==========================================
window.handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    newFilesToUpload.push(...files);
    renderPreviews();
};

function renderPreviews() {
    const container = document.getElementById('image-preview-container');
    if(!container) return;
    container.innerHTML = '';
    existingUrls.forEach((url, index) => container.appendChild(createPreviewCard(url, index, 'url')));
    newFilesToUpload.forEach((file, index) => container.appendChild(createPreviewCard(URL.createObjectURL(file), index, 'file')));
}

function createPreviewCard(src, index, type) {
    const div = document.createElement('div');
    div.className = "relative group aspect-video bg-black rounded-lg overflow-hidden border border-white/20";
    div.innerHTML = `<img src="${src}" class="w-full h-full object-cover">
        <div class="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-2 w-full py-1">${type === 'url' ? '☁️ Guardada' : '⏳ Pendiente'}</div>
        <button onclick="removeImage(${index}, '${type}')" class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><span class="material-symbols-outlined text-sm">close</span></button>`;
    return div;
}

window.removeImage = (index, type) => {
    if (type === 'url') existingUrls.splice(index, 1); else newFilesToUpload.splice(index, 1);
    renderPreviews();
};

window.saveImagesToBackend = async () => {
    const btn = document.querySelector('button[onclick="saveImagesToBackend()"]');
    const originalText = btn.innerText;
    
    if (existingUrls.length === 0 && newFilesToUpload.length === 0) return showToast("Galería vacía", 'error');
    if (!await showConfirm("¿Actualizar Galería?", "Las imágenes se subirán.")) return;

    btn.innerText = "Subiendo..."; btn.disabled = true;

    try {
        const uploadedUrls = [];
        for (const file of newFilesToUpload) {
            const storageRef = ref(storage, `slides/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            uploadedUrls.push(url);
        }
        const finalImageList = [...existingUrls, ...uploadedUrls];
        
        // Para no borrar lo otro, necesitamos los valores actuales
        // (Simplificado: asumimos que el DOM tiene los valores cargados)
        const tickets = ticketsSelect.value;
        const price = priceInput.value;
        const currency = currencySelect.value;
        const manualSold = manualSoldInput.value;
        const isClosed = !statusToggle.checked;
        const isAuto = verificationToggle.checked;

        const response = await fetch(`${CLIENT_API_URL}/config`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                totalTickets: tickets, ticketPrice: price, currency: currency, manualSold: manualSold, isClosed: isClosed, verificationMode: isAuto ? 'auto' : 'manual',
                images: finalImageList 
            })
        });

        if (response.ok) { showToast("Galería actualizada"); newFilesToUpload = []; loadConfig(); }
        else { showToast("Error al guardar", 'error'); }
    } catch (e) { showToast("Error: " + e.message, 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
};

// ==========================================
// 9. SORTEO (GANADOR)
// ==========================================
const winnerModal = document.getElementById('winner-modal');
const manualInput = document.getElementById('manual-winner-input');
const resultBox = document.getElementById('winner-result');

window.openWinnerModal = () => {
    winnerModal.classList.remove('hidden');
    setTimeout(() => {
        winnerModal.classList.remove('opacity-0');
        winnerModal.firstElementChild.nextElementSibling.classList.remove('scale-95');
        winnerModal.firstElementChild.nextElementSibling.classList.add('scale-100');
    }, 10);
    resultBox.classList.add('hidden');
    manualInput.value = '';
};

window.closeWinnerModal = () => {
    winnerModal.classList.add('opacity-0');
    winnerModal.firstElementChild.nextElementSibling.classList.add('scale-95');
    setTimeout(() => winnerModal.classList.add('hidden'), 300);
};

window.findWinner = async (mode) => {
    let numberToSend = null;

    if (mode === 'manual') {
        numberToSend = manualInput.value;
        if (!numberToSend) return showToast("Escribe un número", 'error');
        const digits = (window.CURRENT_POOL_SIZE - 1).toString().length;
        numberToSend = numberToSend.toString().padStart(digits, '0');
    }

    resultBox.classList.remove('hidden');
    document.getElementById('res-number').innerText = "...";
    document.getElementById('res-found').classList.add('hidden');
    document.getElementById('res-not-found').classList.add('hidden');

    try {
        const response = await fetch(`${CLIENT_API_URL}/find-winner`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode, winningNumber: numberToSend })
        });
        const data = await response.json();

        if (response.ok) {
            document.getElementById('res-number').innerText = data.number;
            if (data.found) {
                document.getElementById('res-found').classList.remove('hidden');
                document.getElementById('res-name').innerText = data.client.name;
                document.getElementById('res-ci').innerText = data.client.ci;
                document.getElementById('res-phone').innerText = data.client.phone;
                
                const statusBadge = document.getElementById('res-status-badge');
                const method = data.client.method; 

                statusBadge.className = "mb-3 inline-block px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border";
                if (method === 'manual') {
                    statusBadge.innerText = "⚠️ PENDIENTE POR VERIFICAR";
                    statusBadge.classList.add("bg-orange-500/20", "text-orange-400", "border-orange-500/30");
                } else if (method === 'manual_approved') {
                    statusBadge.innerText = "✅ VERIFICADO (MANUAL)";
                    statusBadge.classList.add("bg-green-500/20", "text-green-400", "border-green-500/30");
                } else {
                    statusBadge.innerText = "✅ VERIFICADO (BANCO)";
                    statusBadge.classList.add("bg-green-500/20", "text-green-400", "border-green-500/30");
                }

            } else { document.getElementById('res-not-found').classList.remove('hidden'); }
        } else { showToast(data.message || "Error", 'error'); }
    } catch (e) { showToast("Error de conexión", 'error'); }
};

// ==========================================
// 10. EXPORTACIÓN
// ==========================================
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSales.filter(s => s.name.toLowerCase().includes(term) || s.ref.includes(term) || s.ci.includes(term));
        renderTable(filtered);
    });
}

window.exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Fecha,Nombre,Cedula,Telefono,Email,Referencia,Monto,Moneda,Numeros\n";
    allSales.forEach(s => {
        let dateStr = s.dateObj?.toDate ? s.dateObj.toDate().toISOString() : "N/A";
        let row = `${dateStr},"${s.name}","${s.ci}","${s.phone}","${s.email}","${s.ref}",${s.totalAmount},"${s.currency||'$'}","${s.numbers.join(' - ')}"`;
        csvContent += row + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `ventas_${CLIENT_ID}.csv`);
    document.body.appendChild(link); link.click();
};

window.viewReceipt = (url) => {
    document.getElementById('receipt-image').src = url;
    document.getElementById('receipt-modal').classList.remove('hidden');
};
window.closeReceiptModal = () => {
    document.getElementById('receipt-modal').classList.add('hidden');
};
// ==========================================
// 11. MAPA DE TICKETS (LÓGICA BASADA EN FIRESTORE)
// ==========================================
let currentMapPage = 0;
const ITEMS_PER_PAGE = 500; 
let soldTicketsMap = {}; 
let currentSelectedTicket = null;

window.openTicketMap = () => {
    // 1. Procesar Ventas
    soldTicketsMap = {};
    
    allSales.forEach(sale => {
        // 🔍 LÓGICA BASADA EN TUS DATOS DE FIRESTORE:
        // Si el status es "pendiente_verificacion", lo marcamos como pendiente (Naranja).
        // Si es cualquier otra cosa (ej: "aprobado"), será verificado (Verde).
        const isPending = (sale.status === 'pendiente_verificacion');

        // Aseguramos que numbers sea un array (por si acaso viene vacío o nulo)
        const numbers = Array.isArray(sale.numbers) ? sale.numbers : [];

        numbers.forEach(num => {
            soldTicketsMap[num.toString()] = {
                name: sale.name || "Cliente",
                phone: sale.phone || "N/A",
                ci: sale.ci || "N/A",
                ref: sale.ref || "N/A",
                method: sale.paymentMethod || "manual",
                status: sale.status, // Guardamos el status original
                isPending: isPending // Booleano para el color
            };
        });
    });

    // 2. Abrir Modal
    const modal = document.getElementById('map-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const content = modal.querySelector('.relative');
        if(content) {
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }
    }, 10);

    // 3. Renderizar
    currentMapPage = 0;
    renderTicketGrid();
};

// ==========================================
// 11. SEGURIDAD MODO DEMO
// ==========================================
function protectDemoMode() {
    // Solo aplica si el usuario es 'demo-pro'
    if (CLIENT_ID !== 'demo-pro') return;

    // Lista de IDs de campos sensibles a bloquear
    const sensitiveFields = [
        'bank-name-input', 
        'bank-code-input', 
        'payment-phone-input', 
        'payment-ci-input', 
        'binance-email-input', 
        'zelle-email-input',
        'new-admin-pin' // También bloqueamos cambiar el PIN
    ];

    sensitiveFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // 1. Deshabilitar el input
            input.disabled = true;
            input.value = "PROTEGIDO EN DEMO"; // Opcional: Ocultar el valor real
            
            // 2. Estilos visuales de bloqueo
            input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-red-900/20');
            
            // 3. Agregar evento al contenedor padre para mostrar alerta al hacer click
            // (Los inputs disabled no disparan eventos click, por eso usamos el padre)
            if (input.parentElement) {
                input.parentElement.onclick = () => {
                    showToast("⛔ Acción bloqueada en MODO DEMO", 'error');
                };
            }
        }
    });

    // También bloqueamos el botón de guardar imágenes para evitar spam en el storage
    const imgBtn = document.querySelector('button[onclick="saveImagesToBackend()"]');
    if(imgBtn) {
        imgBtn.disabled = true;
        imgBtn.classList.add('opacity-50', 'cursor-not-allowed');
        imgBtn.parentElement.onclick = () => showToast("⛔ Subida de imágenes bloqueada en DEMO", 'error');
    }
}

// EJECUTAR AL CARGAR
// Lo llamamos después de un pequeño tiempo para asegurar que loadConfig haya llenado los campos primero
setTimeout(protectDemoMode, 2000);

window.closeTicketMap = () => {
    const modal = document.getElementById('map-modal');
    modal.classList.add('opacity-0');
    const content = modal.querySelector('.relative');
    if(content) content.classList.add('scale-95');
    
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('ticket-detail-footer').classList.add('hidden');
    currentSelectedTicket = null;
};

window.renderTicketGrid = () => {
    const grid = document.getElementById('tickets-grid');
    const label = document.getElementById('map-page-label');
    if(!grid || !label) return;

    grid.innerHTML = ''; 

    // Obtener total de tickets configurado
    const totalTickets = window.CURRENT_POOL_SIZE || 100;
    const start = currentMapPage * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, totalTickets);
    
    label.innerText = `${start} - ${end - 1}`;
    
    // Ceros a la izquierda (ej: 001)
    const padding = (totalTickets - 1).toString().length;

    for (let i = start; i < end; i++) {
        const numStr = i.toString().padStart(padding, '0');
        const ticketData = soldTicketsMap[numStr]; 
        const isSold = !!ticketData;

        const btn = document.createElement('button');
        
        if (isSold) {
            // 🎨 LÓGICA DE COLORES
            if (ticketData.isPending) {
                // 🟠 NARANJA: Pendiente de Verificación
                btn.className = "h-10 bg-orange-500 text-white font-bold rounded flex items-center justify-center text-xs hover:bg-orange-400 transition-all shadow-[0_0_10px_rgba(249,115,22,0.3)] border border-orange-400/50";
            } else {
                // 🟢 VERDE: Aprobado / Verificado
                btn.className = "h-10 bg-primary text-background-dark font-bold rounded flex items-center justify-center text-xs hover:bg-white hover:text-black transition-all shadow-[0_0_10px_rgba(19,236,91,0.3)]";
            }
            
            btn.onclick = () => showTicketDetail(numStr);
        } else {
            // ⚫ GRIS: Libre
            btn.className = "h-10 bg-white/5 text-gray-500 rounded border border-white/10 flex items-center justify-center text-xs cursor-default opacity-50 hover:bg-white/10";
        }
        
        btn.innerText = numStr;
        grid.appendChild(btn);
    }
};

window.showTicketDetail = (numStr) => {
    const data = soldTicketsMap[numStr];
    if (!data) return;

    currentSelectedTicket = numStr;

    const footer = document.getElementById('ticket-detail-footer');
    document.getElementById('detail-number').innerText = numStr;
    document.getElementById('detail-name').innerText = data.name;

    // Configuración del Texto de Estado
    let statusHTML = "";
    if (data.isPending) {
        statusHTML = `<span class="text-[10px] font-bold text-orange-400 uppercase tracking-wide bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">⏳ Pendiente Verificación</span>`;
    } else {
        statusHTML = `<span class="text-[10px] font-bold text-primary uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded border border-primary/20">✅ Verificado</span>`;
    }

    document.getElementById('detail-info').innerHTML = `${data.ci} • ${data.phone}<br><div class="mt-1">${statusHTML}</div>`;
    
    // Color del Círculo Grande en el Footer
    const circle = document.getElementById('detail-number');
    if(data.isPending) {
        circle.className = "w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/20";
    } else {
        circle.className = "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background-dark font-bold text-lg shadow-lg shadow-primary/20";
    }

    footer.classList.remove('hidden');
    // Reiniciar animación
    footer.classList.remove('animate-pulse');
    void footer.offsetWidth; 
    footer.classList.add('animate-pulse');
};

// COPIAR DATOS
window.copyDetail = async () => {
    if (!currentSelectedTicket || !soldTicketsMap[currentSelectedTicket]) return;
    const data = soldTicketsMap[currentSelectedTicket];
    
    const estadoTexto = data.isPending ? "Pendiente de Verificación" : "Verificado";
    const textToCopy = `🎟 Ticket: #${currentSelectedTicket}\n👤 Cliente: ${data.name}\n🆔 CI: ${data.ci}\n📱 Tlf: ${data.phone}\n💳 Ref: ${data.ref}\n📊 Estado: ${estadoTexto}`;

    try {
        await navigator.clipboard.writeText(textToCopy);
        if (typeof showToast === "function") showToast("✅ Datos copiados");
        
        // Animación del botón
        const btn = document.getElementById('btn-copy-detail');
        if (btn) {
            const originalHTML = btn.innerHTML;
            const originalClasses = btn.className;
            
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> <span>¡COPIADO!</span>`;
            btn.className = "flex items-center gap-1 text-xs text-green-400 font-bold uppercase tracking-wider transition-all duration-200 scale-110";
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.className = originalClasses;
            }, 2000);
        }
    } catch (err) {
        console.error("Error copiando", err);
    }
};

// BUSCADOR EN MAPA
window.searchInMap = (val) => {
    if (!val) { renderTicketGrid(); return; }
    const totalTickets = window.CURRENT_POOL_SIZE;
    const num = parseInt(val);
    
    if (!isNaN(num) && num >= 0 && num < totalTickets) {
        currentMapPage = Math.floor(num / ITEMS_PER_PAGE);
        renderTicketGrid();
        
        setTimeout(() => {
            const padding = (totalTickets - 1).toString().length;
            const targetStr = num.toString().padStart(padding, '0');
            
            const buttons = Array.from(document.querySelectorAll('#tickets-grid button'));
            const targetBtn = buttons.find(b => b.innerText === targetStr);

            if(targetBtn) {
                targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetBtn.classList.add('ring-2', 'ring-white', 'scale-110', 'z-10');
                if (soldTicketsMap[targetStr]) showTicketDetail(targetStr);
            }
        }, 100);
    }
};

// PAGINACIÓN
window.changeMapPage = (direction) => {
    const totalTickets = window.CURRENT_POOL_SIZE;
    const maxPage = Math.ceil(totalTickets / ITEMS_PER_PAGE) - 1;
    const newPage = currentMapPage + direction;
    if (newPage >= 0 && newPage <= maxPage) {
        currentMapPage = newPage;
        renderTicketGrid();
        const grid = document.getElementById('tickets-grid');
        if(grid) grid.scrollTop = 0;
    }
};