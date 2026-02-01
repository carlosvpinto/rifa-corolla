// master.js
// ⚠️ URL DE PRODUCCIÓN
//const API_BASE = "https://rifa-carros-corolla.onrender.com/api/master";
 const API_BASE = "http://localhost:3000/api/master"; // Local

// Elementos
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');

// Auto-Login
if (sessionStorage.getItem('master_auth') === 'true') {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadData();
}

// Login
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

// Cargar Datos
async function loadData() {
    try {
        // 1. Cargar Configuración
        const configRes = await fetch(`${API_BASE}/config`);
        const config = await configRes.json();
        
        document.getElementById('software-price').value = config.softwarePrice || 50;
        document.getElementById('master-pin-setting').value = config.masterPin || "0000";

        // 2. Cargar Clientes
        const custRes = await fetch(`${API_BASE}/customers`);
        const customers = await custRes.json();
        
        const table = document.getElementById('customers-table');
        table.innerHTML = "";
        
        let revenue = 0;

        customers.forEach(c => {
            revenue += parseFloat(c.amountPaid) || 0;
            
            // Formatear fecha (timestamp de firebase)
            let dateStr = "N/A";
            if (c.purchaseDate && c.purchaseDate._seconds) {
                dateStr = new Date(c.purchaseDate._seconds * 1000).toLocaleDateString();
            }

            const row = `
                <tr class="hover:bg-white/5">
                    <td class="p-3">${dateStr}</td>
                    <td class="p-3 font-bold text-white">${c.name}<br><span class="text-xs text-gray-500">${c.ci}</span></td>
                    <td class="p-3">${c.phone}<br>${c.email}</td>
                    <td class="p-3 font-mono text-master text-xs">${c.clientId}<br><span class="text-gray-500">PIN: ${c.initialPin}</span></td>
                    <td class="p-3 text-right text-green-400 font-bold">$${c.amountPaid}</td>
                </tr>
            `;
            table.innerHTML += row;
        });

        document.getElementById('total-revenue').innerText = revenue.toFixed(2);
        document.getElementById('total-clients').innerText = customers.length;

    } catch(e) { console.error(e); }
}

// Guardar Configuración
window.saveMasterConfig = async () => {
    const price = document.getElementById('software-price').value;
    const pin = document.getElementById('master-pin-setting').value;

    if(!confirm("¿Guardar cambios maestros?")) return;

    try {
        await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                softwarePrice: price,
                masterPin: pin
            })
        });
        alert("Guardado. El precio en la Landing Page se actualizará.");
    } catch(e) { alert("Error al guardar"); }
};

window.logout = () => {
    sessionStorage.removeItem('master_auth');
    location.reload();
};