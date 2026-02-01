// landing.js

// ⚠️ URL LOCAL (Para probar ahora)
const API_URL = "http://localhost:3000/api/saas/buy";

// const API_URL = "https://rifa-carros-corolla.onrender.com/api/saas/buy"; // Producción

const SOFTWARE_PRICE = 200; 
const modal = document.getElementById('purchase-modal');

// Funciones Modal
window.openPurchaseModal = () => { if(modal) modal.classList.remove('hidden'); };
window.closePurchaseModal = () => { if(modal) modal.classList.add('hidden'); };

// Auto-fecha (Hoy)
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
            paymentDate: document.getElementById('payment-date').value, // <--- NUEVO
            amount: SOFTWARE_PRICE
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
                alert("¡Éxito! Tu software ha sido creado. Redirigiendo a tu panel...");
                window.location.href = result.redirectUrl;
            } else {
                // Mensaje de error más claro
                alert("❌ " + (result.error || "Error desconocido"));
                btn.innerText = originalText;
                btn.disabled = false;
            }

        } catch (error) {
            console.error(error);
            alert("Error de conexión con el servidor (Verifica que esté encendido)");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}