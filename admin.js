// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE Y STORAGE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔴🔴🔴 TUS CREDENCIALES 🔴🔴🔴
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
// 2. SISTEMA DE NOTIFICACIONES (NUEVO)
// ==========================================

// A. Mostrar Toast (Éxito o Error)
function showToast(message, type = 'success') {
    const toast = document.getElementById('admin-toast');
    const title = document.getElementById('toast-title');
    const msg = document.getElementById('toast-message');
    const icon = document.getElementById('toast-icon');
    const border = toast; // El borde es el contenedor mismo

    // Configurar Estilos según tipo
    if (type === 'success') {
        title.innerText = "¡Éxito!";
        icon.innerText = "check_circle";
        icon.className = "material-symbols-outlined text-primary";
        border.className = border.className.replace('border-red-500', 'border-primary');
    } else {
        title.innerText = "Error";
        icon.innerText = "error";
        icon.className = "material-symbols-outlined text-red-500";
        border.classList.replace('border-primary', 'border-red-500'); // Cambiar borde a rojo
        // Si la clase original era fija, aseguramos limpiar clases previas de borde
        toast.classList.remove('border-primary');
        toast.classList.add('border-red-500');
    }

    msg.innerText = message;

    // Mostrar
    toast.classList.remove('translate-x-full', 'opacity-0');
    
    // Ocultar automático
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        // Resetear borde para la próxima
        if(type === 'error') {
            toast.classList.remove('border-red-500');
            toast.classList.add('border-primary');
        }
    }, 3500);
}

// B. Mostrar Modal de Confirmación (Promesa)
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const card = document.getElementById('confirm-card');
        const titleEl = document.getElementById('confirm-title');
        const descEl = document.getElementById('confirm-desc');
        const btnYes = document.getElementById('btn-confirm');
        const btnNo = document.getElementById('btn-cancel');

        titleEl.innerText = title;
        descEl.innerText = message;

        // Mostrar Modal
        modal.classList.remove('hidden');
        // Pequeño delay para la animación
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }, 10);

        const close = (result) => {
            modal.classList.add('opacity-0');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                resolve(result); // Resolver promesa
            }, 300);
        };

        // Eventos (usamos onlick para sobreescribir anteriores)
        btnYes.onclick = () => close(true);
        btnNo.onclick = () => close(false);
    });
}

// ==========================================
// 3. VARIABLES GLOBALES
// ==========================================
const BACKEND_CONFIG_URL = "http://localhost:3000/api/config";
window.CURRENT_POOL_SIZE = 100;
window.CURRENT_PRICE = 5;
window.CURRENT_CURRENCY = '$';

let existingUrls = [];    
let newFilesToUpload = [];

// ==========================================
// 4. SEGURIDAD Y LOGIN
// ==========================================
const ADMIN_PIN = "2026"; 
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const pinInput = document.getElementById('admin-pin');
const loginError = document.getElementById('login-error');

if (sessionStorage.getItem('admin_auth') === 'true') {
    showDashboard();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pinInput.value === ADMIN_PIN) {
        sessionStorage.setItem('admin_auth', 'true');
        showDashboard();
    } else {
        loginError.classList.remove('hidden');
        showToast("PIN Incorrecto", 'error'); // Usando Toast
        pinInput.value = '';
        pinInput.focus();
    }
});

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
    loadConfig(); 
}

window.logout = () => {
    sessionStorage.removeItem('admin_auth');
    location.reload();
};

window.refreshData = async () => {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    await loadConfig(); 
    if(icon) setTimeout(() => icon.classList.remove('animate-spin'), 500);
    showToast("Datos actualizados"); // Feedback visual
};

// ==========================================
// 5. GESTIÓN DE CONFIGURACIÓN
// ==========================================
const ticketsSelect = document.getElementById('total-tickets-select');
const priceInput = document.getElementById('ticket-price-input');
const currencySelect = document.getElementById('currency-select');
const manualSoldInput = document.getElementById('manual-sold-input'); 

async function loadConfig() {
    try {
        const response = await fetch(BACKEND_CONFIG_URL);
        const data = await response.json();
        
        if (data.totalTickets) {
            ticketsSelect.value = data.totalTickets;
            priceInput.value = data.ticketPrice;
            currencySelect.value = data.currency;
            if(manualSoldInput) manualSoldInput.value = data.manualSold || 0;
            
             if (data.images && Array.isArray(data.images)) {
                existingUrls = data.images;
                renderPreviews(); 
            }

            window.CURRENT_POOL_SIZE = parseInt(data.totalTickets);
            window.CURRENT_PRICE = parseFloat(data.ticketPrice);
            window.CURRENT_CURRENCY = data.currency;
            
            loadData();
        }
    } catch (error) { 
        console.error("Error config:", error); 
        showToast("No se pudo cargar la configuración", 'error');
    }
}

// GUARDAR CONFIGURACIÓN (Con nuevos Modals)
window.saveConfig = async () => {
    const newTotal = ticketsSelect.value;
    const newPrice = priceInput.value;
    const newCurrency = currencySelect.value;
    const newManualSold = manualSoldInput.value; 

    // 1. Usar nuestro Confirm personalizado
    const confirmed = await showConfirm(
        "¿Guardar cambios?", 
        `Tickets: ${newTotal} | Precio: ${newPrice} ${newCurrency}`
    );

    if (!confirmed) return;

    const btn = document.querySelector('button[onclick="saveConfig()"]');
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        const response = await fetch(BACKEND_CONFIG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                totalTickets: newTotal,
                ticketPrice: newPrice,
                currency: newCurrency,
                manualSold: newManualSold 
            })
        });

        if (response.ok) {
            showToast("Configuración guardada exitosamente"); // Toast Verde
            window.CURRENT_POOL_SIZE = parseInt(newTotal);
            window.CURRENT_PRICE = parseFloat(newPrice);
            window.CURRENT_CURRENCY = newCurrency;
            loadData();
        } else { 
            showToast("Error al guardar en el servidor", 'error'); // Toast Rojo
        }
    } catch (error) { 
        console.error(error); 
        showToast("Error de conexión", 'error');
    } finally { 
        btn.innerText = originalText; 
        btn.disabled = false; 
    }
};

// ==========================================
// 6. CARGA DE DATOS
// ==========================================
let allSales = []; 

async function loadData() {
    const tableBody = document.getElementById('sales-table-body');
    
    try {
        const q = query(collection(db, "ventas"));
        const querySnapshot = await getDocs(q);
        
        allSales = [];
        let totalMoney = 0;
        let totalTickets = 0;

        querySnapshot.forEach((doc) => {
            const rawData = doc.data();
            
            let qty = rawData.ticketsQty;
            if (!qty && rawData.numbers && Array.isArray(rawData.numbers)) qty = rawData.numbers.length;
            else if (!qty) qty = 0;

            let amount = rawData.totalAmount;
            if (!amount) amount = qty * window.CURRENT_PRICE; 

            let finalDate = rawData.purchaseDate || rawData.date || null;

            const cleanSale = {
                id: doc.id,
                name: rawData.name || "Sin Nombre",
                ci: rawData.ci || "Sin CI",
                email: rawData.email || "Sin Email",
                phone: rawData.phone || "Sin Tlf",
                ref: rawData.ref || "Sin Ref",
                numbers: rawData.numbers || [],
                ticketsQty: qty,
                totalAmount: amount,
                currency: rawData.currency || window.CURRENT_CURRENCY, 
                dateObj: finalDate
            };

            allSales.push(cleanSale);
            totalMoney += amount;
            totalTickets += qty;
        });

        allSales.sort((a, b) => {
            const dateA = a.dateObj && a.dateObj.seconds ? a.dateObj.seconds : 0;
            const dateB = b.dateObj && b.dateObj.seconds ? b.dateObj.seconds : 0;
            return dateB - dateA;
        });

        const availableTickets = window.CURRENT_POOL_SIZE - totalTickets;
        const CURRENCY_SYMBOL = window.CURRENT_CURRENCY || '$';

        document.getElementById('stat-available').innerText = availableTickets;
        document.getElementById('stat-money').innerText = CURRENCY_SYMBOL + " " + totalMoney.toFixed(2); 
        document.getElementById('stat-tickets').innerText = totalTickets;
        document.getElementById('stat-clients').innerText = allSales.length;

        renderTable(allSales);

    } catch (error) {
        console.error("Error cargando datos:", error);
        showToast("Error cargando ventas: " + error.message, 'error');
    }
}

function renderTable(data) {
    const tableBody = document.getElementById('sales-table-body');
    if(!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">No hay ventas registradas aún.</td></tr>';
        return;
    }

    data.forEach(sale => {
        let dateStr = "N/A";
        if (sale.dateObj && sale.dateObj.toDate) {
            dateStr = sale.dateObj.toDate().toLocaleDateString('es-VE', { 
                day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' 
            });
        }
        const saleCurrency = sale.currency || window.CURRENT_CURRENCY;

        const row = document.createElement('tr');
        row.className = "hover:bg-white/5 transition-colors border-b border-white/5";
        row.innerHTML = `
            <td class="p-4 text-gray-300 whitespace-nowrap text-xs">${dateStr}</td>
            <td class="p-4 font-medium text-white">
                ${sale.name}<br>
                <span class="text-xs text-gray-500">${sale.ci}</span>
            </td>
            <td class="p-4"><span class="font-mono text-primary bg-primary/10 px-2 py-1 rounded text-xs">${sale.ref}</span></td>
            <td class="p-4 text-gray-400 text-xs">
                ${sale.phone}<br>${sale.email}
            </td>
            <td class="p-4">
                <div class="flex flex-wrap gap-1 max-w-[200px]">
                    ${sale.numbers.map(n => `<span class="bg-surface-highlight text-white border border-white/10 px-1.5 rounded text-xs font-bold">${n}</span>`).join('')}
                </div>
            </td>
            <td class="p-4 text-right font-bold text-green-400">${saleCurrency} ${sale.totalAmount.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// ==========================================
// 7. GESTOR DE IMÁGENES
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

    existingUrls.forEach((url, index) => {
        container.appendChild(createPreviewCard(url, index, 'url'));
    });

    newFilesToUpload.forEach((file, index) => {
        const localUrl = URL.createObjectURL(file);
        container.appendChild(createPreviewCard(localUrl, index, 'file'));
    });
}

function createPreviewCard(src, index, type) {
    const div = document.createElement('div');
    div.className = "relative group aspect-video bg-black rounded-lg overflow-hidden border border-white/20";
    div.innerHTML = `
        <img src="${src}" class="w-full h-full object-cover">
        <div class="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-2 w-full py-1">
            ${type === 'url' ? '☁️ Guardada' : '⏳ Pendiente'}
        </div>
        <button onclick="removeImage(${index}, '${type}')" class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110">
            <span class="material-symbols-outlined text-sm">close</span>
        </button>
    `;
    return div;
}

window.removeImage = (index, type) => {
    if (type === 'url') existingUrls.splice(index, 1);
    else newFilesToUpload.splice(index, 1);
    renderPreviews();
};

// GUARDAR IMÁGENES (Con Modals)
window.saveImagesToBackend = async () => {
    const btn = document.querySelector('button[onclick="saveImagesToBackend()"]');
    const originalText = btn.innerText;
    
    if (existingUrls.length === 0 && newFilesToUpload.length === 0) {
        return showToast("La galería no puede quedar vacía", 'error');
    }

    // 1. Confirmar con Modal
    const confirmed = await showConfirm(
        "¿Actualizar Galería?", 
        "Las imágenes nuevas se subirán a la nube."
    );
    if (!confirmed) return;

    btn.innerText = "Subiendo...";
    btn.disabled = true;

    try {
        const uploadedUrls = [];

        // Subir nuevos
        for (const file of newFilesToUpload) {
            const storageRef = ref(storage, `slides/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            uploadedUrls.push(url);
        }

        const finalImageList = [...existingUrls, ...uploadedUrls];
        const tickets = document.getElementById('total-tickets-select').value;
        const price = document.getElementById('ticket-price-input').value;
        const currency = document.getElementById('currency-select').value;
        const manualSold = document.getElementById('manual-sold-input').value;

        btn.innerText = "Guardando...";

        const response = await fetch(BACKEND_CONFIG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                totalTickets: tickets,
                ticketPrice: price,
                currency: currency,
                manualSold: manualSold,
                images: finalImageList 
            })
        });

        if (response.ok) {
            showToast("Galería actualizada correctamente");
            newFilesToUpload = []; 
            loadConfig(); 
        } else {
            showToast("Error al guardar en base de datos", 'error');
        }

    } catch (e) {
        console.error(e);
        showToast("Error de conexión: " + e.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// 8. EXPORTACIÓN
// ==========================================
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSales.filter(s => 
            s.name.toLowerCase().includes(term) || 
            s.ref.includes(term) || 
            s.ci.includes(term)
        );
        renderTable(filtered);
    });
}

window.exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha,Nombre,Cedula,Telefono,Email,Referencia,Monto,Moneda,Numeros\n";
    allSales.forEach(s => {
        let dateStr = s.dateObj && s.dateObj.toDate ? s.dateObj.toDate().toISOString() : "N/A";
        let nums = s.numbers.join(" - ");
        let saleCur = s.currency || window.CURRENT_CURRENCY;
        let row = `${dateStr},"${s.name}","${s.ci}","${s.phone}","${s.email}","${s.ref}",${s.totalAmount},"${saleCur}","${nums}"`;
        csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_ventas.csv");
    document.body.appendChild(link);
    link.click();
};