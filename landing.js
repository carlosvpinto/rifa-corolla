// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================

// ⚠️ URL DE PRODUCCIÓN (Render) - COMENTADA
// const API_URL = "https://rifa-carros-corolla.onrender.com/api/saas/buy";
// const MASTER_CONFIG_URL = "https://rifa-carros-corolla.onrender.com/api/master/config";

// ⚠️ URL LOCAL (Para pruebas) - ACTIVA
const API_URL = "http://localhost:3000/api/saas/buy";
const MASTER_CONFIG_URL = "http://localhost:3000/api/master/config";

// ==========================================
// LÓGICA DE NEGOCIO
// ==========================================

// Precio por defecto (se actualizará desde el servidor)
let SOFTWARE_PRICE = 50; 

// 1. CARGAR PRECIO ACTUALIZADO DEL SERVIDOR
fetch(MASTER_CONFIG_URL)
  .then(res => {
    console.log("Status respuesta:", res.status);
    return res.json();
  })
  .then(data => {
    console.log("JSON recibido en /api/master/config:", data);
    console.log("typeof softwarePrice:", typeof data.softwarePrice);

    const price = parseFloat(data.softwarePrice);
    console.log("softwarePrice parseado:", price);

    if (!isNaN(price)) {
      SOFTWARE_PRICE = price;
      const btnDisplay = document.getElementById('btn-buy-license');
      if (btnDisplay) {
        btnDisplay.innerText = `Obtener Licencia por $${SOFTWARE_PRICE}`;
        console.log("Botón actualizado con precio:", SOFTWARE_PRICE);
      } else {
        console.warn("No se encontró #btn-buy-license en el DOM");
      }
    } else {
      console.warn("softwarePrice no es numérico o no vino en la respuesta");
    }
  })
  .catch(err => console.error("Error cargando precio maestro:", err));


// 2. FUNCIONES DEL MODAL
const modal = document.getElementById('purchase-modal');

window.openPurchaseModal = () => {
    if(modal) modal.classList.remove('hidden');
};

window.closePurchaseModal = () => {
    if(modal) modal.classList.add('hidden');
};

// 3. AUTO-FECHA (HOY)
const dateInput = document.getElementById('payment-date');
if (dateInput) {
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localIso;
}

// 4. ENVÍO DEL FORMULARIO DE COMPRA
const saasForm = document.getElementById('saas-form');

if (saasForm) {
    saasForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = e.target.querySelector('button');
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
            amount: SOFTWARE_PRICE // Usamos el precio dinámico cargado
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                btn.classList.replace('bg-primary', 'bg-green-500');
                btn.innerText = "¡ACTIVADO!";
                alert("¡Felicidades! Tu software ha sido creado. Te estamos redirigiendo a tu nuevo panel.");
                
                // Redirigir al dashboard nuevo del cliente
                window.location.href = result.redirectUrl;
            } else {
                alert("❌ " + (result.error || "Pago no encontrado o datos inválidos."));
                btn.innerText = originalText;
                btn.disabled = false;
            }

        } catch (error) {
            console.error(error);
            alert("Error de conexión con el servidor (Asegúrate de que 'node index.js' esté corriendo).");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}