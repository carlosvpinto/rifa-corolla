// branding.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔴 PEGA TUS CREDENCIALES AQUÍ (IGUAL QUE EN ADMIN.JS)
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
const storage = getStorage(app);

// ⚠️ URL DE PRODUCCIÓN
//const API_URL = "https://rifa-carros-corolla.onrender.com/api/config";
 const API_URL = "http://localhost:3000/api/config"; // Para local
// ... (Imports y Configuración Firebase igual) ...

// Referencias DOM (Ya sin colorInput)
const nameInput = document.getElementById('company-name');
const logoInput = document.getElementById('upload-logo');
const iconInput = document.getElementById('upload-icon');
const logoPreview = document.getElementById('preview-logo');
const iconPreview = document.getElementById('preview-icon');

let currentLogoUrl = "";
let currentIconUrl = "";

async function loadData() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        
        if (data.companyName) nameInput.value = data.companyName;
        // YA NO CARGAMOS COLOR
        
        if (data.logoUrl) {
            currentLogoUrl = data.logoUrl;
            logoPreview.src = data.logoUrl;
        }
        if (data.faviconUrl) {
            currentIconUrl = data.faviconUrl;
            iconPreview.src = data.faviconUrl;
        }
    } catch (e) { console.error("Error cargando:", e); }
}

loadData();

window.previewImage = (event, imgId) => {
    const file = event.target.files[0];
    if(file) document.getElementById(imgId).src = URL.createObjectURL(file);
};

window.saveBranding = async () => {
    const btn = document.querySelector('button[onclick="saveBranding()"]');
    btn.innerText = "Guardando..."; btn.disabled = true;

    try {
        let newLogoUrl = currentLogoUrl;
        let newIconUrl = currentIconUrl;

        if(logoInput.files[0]) {
            const storageRef = ref(storage, `branding/logo_${Date.now()}`);
            await uploadBytes(storageRef, logoInput.files[0]);
            newLogoUrl = await getDownloadURL(storageRef);
        }

        if(iconInput.files[0]) {
            const storageRef = ref(storage, `branding/icon_${Date.now()}`);
            await uploadBytes(storageRef, iconInput.files[0]);
            newIconUrl = await getDownloadURL(storageRef);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyName: nameInput.value,
                logoUrl: newLogoUrl,
                faviconUrl: newIconUrl
                // YA NO ENVIAMOS primaryColor
            })
        });

        if(response.ok) alert("¡Marca actualizada!");
        else alert("Error al guardar");

    } catch (e) { alert("Error de conexión"); } 
    finally { btn.innerText = "Guardar Cambios"; btn.disabled = false; }
};

window.resetBranding = async () => {
    if(!confirm("¿Borrar logo e icono?")) return;
    try {
        nameInput.value = "";
        document.getElementById('preview-logo').src = "";
        document.getElementById('preview-icon').src = "";
        
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: "", logoUrl: "", faviconUrl: "" })
        });
        alert("Restablecido.");
    } catch (e) { alert("Error"); }
};