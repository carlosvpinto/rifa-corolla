import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
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
const storage = getStorage(app);

// 1. OBTENER ID DEL CLIENTE (SaaS)
const urlParams = new URLSearchParams(window.location.search);
const CLIENT_ID = urlParams.get('id') || 'demo';

console.log("🎨 Configurando Marca para:", CLIENT_ID);

// 2. CONFIGURAR BOTÓN "ATRÁS" DINÁMICAMENTE
// Esto asegura que al volver, regreses al admin DE ESTE CLIENTE
const backBtn = document.querySelector('a[href="admin.html"]');
if (backBtn) {
    backBtn.href = `admin.html?id=${CLIENT_ID}`;
}

// ⚠️ URL DE PRODUCCIÓN (RENDER)
// const BASE_API = "https://rifa-carros-corolla.onrender.com/api";
// ⚠️ URL LOCAL (PARA PRUEBAS)
const BASE_API = "https://rifa-carros-corolla.onrender.com/api";

const API_URL = `${BASE_API}/${CLIENT_ID}/config`;

// Referencias DOM
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

        // A. Subir Logo (Carpeta del Cliente)
        if(logoInput.files[0]) {
            const file = logoInput.files[0];
            // Guardamos en una carpeta única para este cliente para no mezclar fotos
            const storageRef = ref(storage, `tenants/${CLIENT_ID}/branding/logo_${Date.now()}`);
            await uploadBytes(storageRef, file);
            newLogoUrl = await getDownloadURL(storageRef);
        }

        // B. Subir Icono (Carpeta del Cliente)
        if(iconInput.files[0]) {
            const file = iconInput.files[0];
            const storageRef = ref(storage, `tenants/${CLIENT_ID}/branding/icon_${Date.now()}`);
            await uploadBytes(storageRef, file);
            newIconUrl = await getDownloadURL(storageRef);
        }

        // C. Guardar en Backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyName: nameInput.value,
                logoUrl: newLogoUrl,
                faviconUrl: newIconUrl
            })
        });

        if(response.ok) alert("¡Marca actualizada!");
        else alert("Error al guardar");

    } catch (e) { 
        console.error(e); 
        alert("Error de conexión"); 
    } finally {
        btn.innerText = "Guardar Cambios"; btn.disabled = false;
    }
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