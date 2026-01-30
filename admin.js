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

// ==========================================
// 2. UI HELPERS (TOAST Y CONFIRM)
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
// ⚠️ URL DE PRODUCCIÓN (RENDER)
//const API_BASE_URL = "https://rifa-carros-corolla.onrender.com/api"; 
const API_BASE_URL = "http://localhost:3000/api";

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
if (sessionStorage.getItem('admin_auth') === 'true') showDashboard();

// Login contra el servidor
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputPin = pinInput.value;
    const btn = loginForm.querySelector('button');
    const originalText = btn.innerText;
    
    btn.innerText = "Verificando..."; btn.disabled = true;
    loginError.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: inputPin })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            sessionStorage.setItem('admin_auth', 'true');
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

window.logout = () => { sessionStorage.removeItem('admin_auth'); location.reload(); };
window.refreshData = async () => {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    await loadConfig(); 
    if(icon) setTimeout(() => icon.classList.remove('animate-spin'), 500);
    showToast("Datos actualizados");
};

// ==========================================
// 4. LÓGICA DE MENÚ Y MODAL SEGURIDAD
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

window.openSecurityModal = () => {
    const modal = document.getElementById('security-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.firstElementChild.nextElementSibling.classList.remove('opacity-0', 'scale-95'), 10);
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    closeMenu();
};

window.closeSecurityModal = () => {
    const modal = document.getElementById('security-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// Guardar nuevo PIN
window.saveNewPin = async () => {
    const newPin = document.getElementById('new-admin-pin').value;
    if(!newPin || newPin.trim() === "") return showToast("El PIN no puede estar vacío", 'error');

    if(!await showConfirm("¿Cambiar PIN?", "Deberás usar el nuevo PIN la próxima vez.")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPin: newPin })
        });

        if(response.ok) {
            showToast("PIN actualizado correctamente");
            closeSecurityModal();
            document.getElementById('new-admin-pin').value = "";
        } else {
            showToast("Error al guardar PIN", 'error');
        }
    } catch (e) { showToast("Error de conexión", 'error'); }
};

// ==========================================
// 9. MÓDULO DE PREMIACIÓN
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
    // Limpiar vista anterior
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

    // Lógica para modo manual (Input)
    if (mode === 'manual') {
        numberToSend = manualInput.value;
        if (!numberToSend) return showToast("Escribe un número", 'error');
        // Ajuste de ceros (padding)
        const digits = (window.CURRENT_POOL_SIZE - 1).toString().length;
        numberToSend = numberToSend.toString().padStart(digits, '0');
    }

    // Efectos visuales de carga
    resultBox.classList.remove('hidden');
    document.getElementById('res-number').innerText = "...";
    document.getElementById('res-found').classList.add('hidden');
    document.getElementById('res-not-found').classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/find-winner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode, winningNumber: numberToSend })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('res-number').innerText = data.number;

            if (data.found) {
                // MOSTRAR DATOS
                document.getElementById('res-found').classList.remove('hidden');
                document.getElementById('res-name').innerText = data.client.name;
                document.getElementById('res-ci').innerText = data.client.ci;
                document.getElementById('res-phone').innerText = data.client.phone;
                
                // --- LÓGICA DE ESTADOS (CORREGIDA SEGÚN TU BD) ---
                const statusBadge = document.getElementById('res-status-badge');
                
                // Obtenemos el método directamente de la respuesta del servidor
                // (Asegúrate de que en server/index.js estés enviando: method: winnerDoc.verificationMethod)
                const method = data.client.method; 

                // Limpiar clases anteriores
                statusBadge.className = "mb-3 inline-block px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border";

                if (method === 'manual') {
                    // CASO 1: Reportado por usuario, falta tu clic (Naranja)
                    statusBadge.innerText = "⚠️ PENDIENTE POR VERIFICAR";
                    statusBadge.classList.add("bg-orange-500/20", "text-orange-400", "border-orange-500/30");
                } 
                else if (method === 'manual_approved') {
                    // CASO 2: Tú ya le diste al botón de validar (Verde)
                    statusBadge.innerText = "✅ VERIFICADO (MANUAL)";
                    statusBadge.classList.add("bg-green-500/20", "text-green-400", "border-green-500/30");
                } 
                else if (method === 'auto') {
                    // CASO 3: Validado por Mercantil (Verde)
                    statusBadge.innerText = "✅ VERIFICADO (BANCO)";
                    statusBadge.classList.add("bg-green-500/20", "text-green-400", "border-green-500/30");
                }
                else {
                    // Fallback por si acaso
                    statusBadge.innerText = "ESTADO DESCONOCIDO";
                    statusBadge.classList.add("bg-gray-500/20", "text-gray-400", "border-gray-500/30");
                }

            } else {
                document.getElementById('res-not-found').classList.remove('hidden');
            }
        } else {
            showToast(data.message || "Error", 'error');
            resultBox.classList.add('hidden');
        }

    } catch (e) {
        console.error(e);
        showToast("Error de conexión", 'error');
        resultBox.classList.add('hidden');
    }
};

// ==========================================
// 5. CONFIGURACIÓN GENERAL
// ==========================================
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

// Eventos visuales switches
if(statusToggle) {
    statusToggle.addEventListener('change', () => {
        statusLabel.innerText = statusToggle.checked ? "ABIERTO" : "CERRADO";
        statusLabel.className = statusToggle.checked ? "ml-3 text-xs font-bold text-primary tracking-wider" : "ml-3 text-xs font-bold text-gray-400 tracking-wider";
    });
}
if(verificationToggle) {
    verificationToggle.addEventListener('change', () => {
        verificationLabel.innerText = verificationToggle.checked ? "AUTOMÁTICO" : "MANUAL";
        verificationLabel.className = verificationToggle.checked ? "ml-3 text-xs font-bold text-blue-400 tracking-wider" : "ml-3 text-xs font-bold text-orange-400 tracking-wider";
    });
}

// Cargar Config
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/config`);
        const data = await response.json();
        
        if (data.totalTickets) {
            if(ticketsSelect) ticketsSelect.value = data.totalTickets;
            if(priceInput) priceInput.value = data.ticketPrice;
            if(currencySelect) currencySelect.value = data.currency;
            if(manualSoldInput) manualSoldInput.value = data.manualSold || 0;
            if(titleInput) titleInput.value = data.raffleTitle || "";
            if(codeInput) codeInput.value = data.drawCode || "";

            // Switch Estado (Invertido: isClosed=true -> checked=false)
            if(statusToggle) {
                statusToggle.checked = !data.isClosed; 
                statusToggle.dispatchEvent(new Event('change'));
            }

            // Switch Verificación (Manual/Auto)
            if(verificationToggle) {
                // Si es manual, checked=false. Si es auto (o null), checked=true
                verificationToggle.checked = data.verificationMode !== 'manual';
                verificationToggle.dispatchEvent(new Event('change'));
            }

            // Imágenes
             if (data.images && Array.isArray(data.images)) {
                existingUrls = data.images;
                renderPreviews(); 
            }

            if(bankNameInput) bankNameInput.value = data.bankName || "Mercantil";
            if(bankCodeInput) bankCodeInput.value = data.bankCode || "0105";
            if(paymentPhoneInput) paymentPhoneInput.value = data.paymentPhone || "04141234567";
            if(paymentCIInput) paymentCIInput.value = data.paymentCI || "J-123456789";

            window.CURRENT_POOL_SIZE = parseInt(data.totalTickets);
            window.CURRENT_PRICE = parseFloat(data.ticketPrice);
            window.CURRENT_CURRENCY = data.currency;
            
            loadData();
        }
    } catch (error) { console.error(error); }
}

// Guardar Config
window.saveConfig = async () => {
    const newTotal = ticketsSelect.value;
    const newPrice = priceInput.value;
    const newCurrency = currencySelect.value;
    const newManualSold = manualSoldInput.value; 
    const isRaffleOpen = statusToggle.checked; 
    const newTitle = titleInput.value;
    const newCode = codeInput.value;
    
     // Obtener valores bancarios
    const bankName = bankNameInput.value;
    const bankCode = bankCodeInput.value;
    const payPhone = paymentPhoneInput.value;
    const payCI = paymentCIInput.value;

    // Verificación Manual/Auto
    const isAutoVerification = verificationToggle.checked;
    const modeToSend = isAutoVerification ? 'auto' : 'manual';

    if (!await showConfirm("¿Guardar cambios?", "Se actualizará la configuración de la rifa.")) return;

    const btn = document.querySelector('button[onclick="saveConfig()"]');
    const originalText = btn.innerText;
    btn.innerText = "Guardando..."; btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                totalTickets: newTotal,
                ticketPrice: newPrice,
                currency: newCurrency,
                manualSold: newManualSold,
                isClosed: !isRaffleOpen,
                raffleTitle: newTitle, 
                drawCode: newCode,
                verificationMode: modeToSend, // <--- Enviamos el modo
                 // 🔴 NUEVOS CAMPOS
                bankName: bankName,
                bankCode: bankCode,
                paymentPhone: payPhone,
                paymentCI: payCI
            })
        });

        if (response.ok) {
            showToast("Configuración guardada");
            window.CURRENT_POOL_SIZE = parseInt(newTotal);
            window.CURRENT_PRICE = parseFloat(newPrice);
            window.CURRENT_CURRENCY = newCurrency;
            loadData();
        } else { showToast("Error del servidor", 'error'); }
    } catch (error) { showToast("Error de conexión", 'error'); } 
    finally { btn.innerText = originalText; btn.disabled = false; }
};

// ==========================================
// 6. CARGA DE DATOS DE VENTAS (TABLA RESPONSIVE)
// ==========================================
let allSales = []; 

async function loadData() {
    const tableBody = document.getElementById('sales-table-body');
    try {
        const q = query(collection(db, "ventas"));
        const querySnapshot = await getDocs(q);
        allSales = [];
        let totalMoney = 0; let totalTickets = 0;

        querySnapshot.forEach((doc) => {
            const rawData = doc.data();
            let qty = rawData.ticketsQty;
            if (!qty && rawData.numbers && Array.isArray(rawData.numbers)) qty = rawData.numbers.length; else if (!qty) qty = 0;
            let amount = rawData.totalAmount;
            if (!amount) amount = qty * window.CURRENT_PRICE; 
            
            allSales.push({
                id: doc.id, ...rawData, ticketsQty: qty, totalAmount: amount, 
                currency: rawData.currency || window.CURRENT_CURRENCY,
                dateObj: rawData.purchaseDate || rawData.date || null
            });
            totalMoney += amount; totalTickets += qty;
        });

        allSales.sort((a, b) => (b.dateObj?.seconds || 0) - (a.dateObj?.seconds || 0));

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
        
        // 2. Moneda
        const saleCurrency = sale.currency || window.CURRENT_CURRENCY;

        // 3. LÓGICA DE ESTADO (Botón vs Ícono)
        // Es pendiente SOLO si es 'manual'. Si es 'auto' o 'manual_approved', es verificado.
        const isPending = sale.verificationMethod === 'manual';
        
        let statusIcon;

        if (isPending) {
            // Botón Naranja para Validar
            statusIcon = `
                <button onclick="approveSale('${sale.id}', '${sale.name}')" 
                        class="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 group border border-orange-500/20 ml-auto mt-1"
                        title="Click para confirmar el pago en el banco">
                    <span class="material-symbols-outlined text-[16px]">pending_actions</span>
                    <span class="text-[10px] font-bold uppercase group-hover:underline">Validar</span>
                </button>
            `;
        } else {
            // Check Verde Estático
            statusIcon = `
                <div class="flex items-center justify-end gap-1 text-primary mt-1 opacity-80" title="Pago Verificado">
                    <span class="text-[10px] font-bold uppercase tracking-wider">Listo</span>
                    <span class="material-symbols-outlined text-[18px]">verified</span>
                </div>
            `;
        }

        const row = document.createElement('tr');
        row.className = "hover:bg-white/5 transition-colors border-b border-white/5";
        
        row.innerHTML = `
            <!-- 1. Fecha (Solo PC) -->
            <td class="p-3 text-gray-400 text-[10px] hidden sm:table-cell whitespace-nowrap align-top">
                ${dateStr}
            </td>
            
            <!-- 2. Cliente (Nombre + CI en Móvil) -->
            <td class="p-3 align-top">
                <div class="font-bold text-white text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">
                    ${sale.name}
                </div>
                <div class="text-[10px] text-primary sm:hidden">
                    ${sale.ci}
                </div>
            </td>

            <!-- 3. Referencia -->
            <td class="p-3 align-top">
                <span class="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px] tracking-wider">
                    ${sale.ref}
                </span>
            </td>

            <!-- 4. Contacto + CI (Solo PC) -->
            <td class="p-3 text-gray-400 text-xs hidden sm:table-cell align-top">
                <span class="text-primary font-bold">${sale.ci}</span><br>
                ${sale.phone}
            </td>

            <!-- 5. Tickets (Scroll en Móvil, Wrap en PC) -->
            <td class="p-3 max-w-[120px] sm:max-w-none align-top">
                <div class="flex gap-1 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-1">
                    ${sale.numbers.map(n => `
                        <span class="bg-surface-highlight border border-white/10 text-white px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex-shrink-0">
                            ${n}
                        </span>
                    `).join('')}
                </div>
            </td>

            <!-- 6. Monto + Acción -->
            <td class="p-3 text-right align-top">
                <div class="font-bold text-green-400 text-xs sm:text-sm whitespace-nowrap">
                    ${saleCurrency} ${sale.totalAmount.toFixed(2)}
                </div>
                <!-- Aquí insertamos el botón o el ícono -->
                ${statusIcon}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// ==========================================
// 7. GESTOR DE IMÁGENES (STORAGE)
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
        
        // Mantener configuración actual al guardar fotos
        const tickets = document.getElementById('total-tickets-select').value;
        const price = document.getElementById('ticket-price-input').value;
        const currency = document.getElementById('currency-select').value;
        const manualSold = document.getElementById('manual-sold-input').value;
        const isClosed = !document.getElementById('raffle-status-toggle').checked;
        const newTitle = titleInput.value;
        const newCode = codeInput.value;
        const isAuto = verificationToggle.checked;

        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                totalTickets: tickets, ticketPrice: price, currency: currency, manualSold: manualSold, isClosed: isClosed,
                raffleTitle: newTitle, drawCode: newCode, verificationMode: isAuto ? 'auto' : 'manual',
                images: finalImageList 
            })
        });

        if (response.ok) { showToast("Galería actualizada"); newFilesToUpload = []; loadConfig(); }
        else { showToast("Error al guardar", 'error'); }
    } catch (e) { showToast("Error: " + e.message, 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
};

// APROBAR VENTA MANUALMENTE
window.approveSale = async (saleId, clientName) => {
    // 1. Confirmar Acción
    if (!await showConfirm("¿Aprobar Pago?", `Confirmar pago de ${clientName}.\nSe enviará el correo de validación.`)) return;

    // Feedback visual inmediato (buscamos el botón y lo ponemos cargando)
    // (Opcional, pero se ve bien)
    
    showToast("Procesando aprobación...", 'success');

    try {
        const response = await fetch(`${API_BASE_URL}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saleId: saleId })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`✅ Pago de ${clientName} aprobado`);
            loadData(); // Recargar tabla para ver el check verde
        } else {
            showToast(result.error || "Error al aprobar", 'error');
        }
    } catch (e) {
        console.error(e);
        showToast("Error de conexión", 'error');
    }
};

// ==========================================
// 8. BÚSQUEDA Y EXPORTACIÓN
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
    link.setAttribute("download", "reporte_ventas.csv");
    document.body.appendChild(link); link.click();
};