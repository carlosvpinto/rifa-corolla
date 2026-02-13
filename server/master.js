// master.js

// ⚠️ URL DE PRODUCCIÓN (Render)
//const API_BASE = "https://rifa-carros-corolla.onrender.com/api/master";
// ⚠️ URL LOCAL
const API_BASE = "https://rifa-carros-corolla.onrender.com/api/master"; 

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');

// 1. AUTO-LOGIN
if (sessionStorage.getItem('master_auth') === 'true') {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadData();
}

// 2. LOGIN
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('master-pin').value;
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        
        if (res.ok) {
            sessionStorage.setItem('master_auth', 'true');
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadData();
        } else {
            alert("PIN Incorrecto");
        }
    } catch(e) { alert("Error de conexión"); }
});

// 3. CARGAR DATOS (LÓGICA ACTUALIZADA PARA DOBLE MONEDA)
async function loadData() {
    try {
        // A. Cargar Configuración
        const configRes = await fetch(`${API_BASE}/config`);
        const config = await configRes.json();
        
        document.getElementById('software-price').value = config.softwarePrice || 50;
        document.getElementById('master-pin-setting').value = config.masterPin || "0000";
        if(document.getElementById('master-bank-info')) {
            document.getElementById('master-bank-info').value = config.bankInfo || "";
        }

        // B. Cargar Clientes (Ventas)
        const custRes = await fetch(`${API_BASE}/customers`);
        const customers = await custRes.json();
        
        const table = document.getElementById('customers-table');
        table.innerHTML = "";
        
        // Variables para totales
        let totalUSD = 0;
        let totalVES = 0;

        customers.forEach(c => {
            // Manejo de datos viejos vs nuevos
            // Si existe amountPaidUSD úsalo, sino busca amountPaid (versiones viejas), sino 0
            const usd = parseFloat(c.amountPaidUSD || c.amountPaid || 0);
            const ves = parseFloat(c.amountPaidVES || 0);
            const rate = parseFloat(c.exchangeRate || 0);

            totalUSD += usd;
            totalVES += ves;
            
            // Formatear fecha
            let dateStr = "N/A";
            if (c.purchaseDate && c.purchaseDate._seconds) {
                // Multiplicamos por 1000 para convertir segundos a milisegundos
                dateStr = new Date(c.purchaseDate._seconds * 1000).toLocaleDateString('es-VE');
            }

            const row = `
                <tr class="hover:bg-white/5 border-b border-white/5 transition-colors">
                    <td class="p-3 text-gray-400 font-mono text-xs">${dateStr}</td>
                    
                    <td class="p-3">
                        <div class="font-bold text-white">${c.name || "Sin Nombre"}</div>
                        <div class="text-xs text-gray-500">${c.ci || ""}</div>
                    </td>
                    
                    <td class="p-3 text-sm text-gray-300">
                        ${c.phone}<br>
                        <span class="text-xs text-gray-500">${c.email}</span>
                    </td>
                    
                    <td class="p-3">
                        <div class="font-mono text-master text-xs bg-master/10 px-2 py-1 rounded w-fit">
                            ${c.clientId}
                        </div>
                        <div class="text-[10px] text-gray-500 mt-1">
                            Ref: ${c.paymentRef} | PIN: ${c.initialPin}
                        </div>
                    </td>
                    
                    <td class="p-3 text-right align-top">
                        <div class="font-bold text-green-400 text-lg">$${usd.toFixed(2)}</div>
                        ${ves > 0 ? `<div class="text-xs text-gray-500">Bs. ${ves.toFixed(2)}</div>` : ''}
                        ${rate > 0 ? `<div class="text-[9px] text-gray-600">Tasa: ${rate}</div>` : ''}
                    </td>
                </tr>
            `;
            table.innerHTML += row;
        });

        // Actualizar Tarjeta de Totales
        const revenueDisplay = document.getElementById('total-revenue');
        revenueDisplay.innerHTML = `
            $${totalUSD.toFixed(2)}
            <span class="text-sm text-gray-500 block font-normal mt-1">
                + Bs. ${totalVES.toFixed(2)}
            </span>
        `;
        
        document.getElementById('total-clients').innerText = customers.length;

    } catch(e) { console.error(e); }
}

// 4. GUARDAR CONFIGURACIÓN MAESTRA
window.saveMasterConfig = async () => {
    const price = document.getElementById('software-price').value;
    const pin = document.getElementById('master-pin-setting').value;
    // const bank = document.getElementById('master-bank-info').value; // Si lo agregas en HTML

    if(!confirm("¿Guardar cambios maestros?")) return;

    try {
        await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                softwarePrice: price,
                masterPin: pin,
                // bankInfo: bank 
            })
        });
        alert("Configuración Maestra Actualizada.");
    } catch(e) { alert("Error al guardar"); }
};

window.logout = () => {
    sessionStorage.removeItem('master_auth');
    location.reload();
};