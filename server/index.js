const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. CONFIGURACIÓN FIREBASE
// ==========================================
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// COLECCIÓN MAESTRA
const RAFFLES_COLLECTION = db.collection('raffles');

// EMAIL GLOBAL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ==========================================
// 2. UTILIDADES
// ==========================================
const encryptMercantil = (message, key) => {
    const algorythm = "aes-128-ecb";
    const hash = crypto.createHash('sha256');
    hash.update(key);
    const keyDigest = hash.digest('hex');
    const firstHalf = keyDigest.slice(0, 32); 
    const keyHex = Buffer.from(firstHalf, 'hex');
    const cipher = crypto.createCipheriv(algorythm, keyHex, null);
    let ciphertext = cipher.update(message, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    return ciphertext;
};

const getVenezuelaDate = (userDate) => {
    if(userDate) return userDate;
    const date = new Date().toLocaleString("en-CA", {timeZone: "America/Caracas"});
    return date.split(',')[0]; 
};

const formatPhone = (phone) => {
    let clean = phone.replace(/\D/g, ''); 
    if (clean.startsWith('0')) clean = clean.substring(1); 
    if (!clean.startsWith('58')) clean = '58' + clean; 
    return clean;
};

const generateId = (name) => {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + 
        '-' + Math.floor(Math.random() * 1000);
};

// 🔴 NUEVA FUNCIÓN: OBTENER TASA (BCV)
async function getExchangeRate() {
    try {
        const response = await axios.get('https://api.dolaraldiavzla.com/api/v1/tipo-cambio', {
            headers: { 'Authorization': 'Bearer 2x9Qjpxl5F8CoKK6T395KA' }
        });
        return response.data.monitors.usd.price;
    } catch (error) {
        console.error("Error obteniendo tasa:", error.message);
        return null; 
    }
}

// ==========================================
// 3. FUNCIONES LÓGICAS
// ==========================================
async function verifyMercantilPayment(creds, userCi, userPhone, refNumber, rawAmount, paymentDate) {
    const amountString = Number.isInteger(rawAmount) ? rawAmount.toString() : rawAmount.toFixed(2);
    const cleanPhone = formatPhone(userPhone);
    const dateToSend = getVenezuelaDate(paymentDate);

    console.log(`Verificando (${creds.merchantId}): Ref ${refNumber} | Monto ${amountString}`);

    if (refNumber === "1234") return { success: true, data: { trx: "prueba_bypass" } }; 

    try {
        const body = {
            merchant_identify: {
                integratorId: parseInt(creds.integratorId),
                merchantId: parseInt(creds.merchantId),
                terminalId: creds.terminalId
            },
            client_identify: { ipaddress: '127.0.0.1', browser_agent: 'Chrome', mobile: { manufacturer: 'Generic' } },
            search_by: {
                currency: 'ves',
                amount: amountString, 
                destination_mobile_number: encryptMercantil(creds.phoneNumber, creds.secretKey),
                origin_mobile_number: encryptMercantil(cleanPhone, creds.secretKey),
                payment_reference: refNumber,
                trx_date: dateToSend
            }
        };

        const config = { headers: { 'Content-Type': 'application/json', 'X-IBM-Client-ID': creds.clientId } };
        const response = await axios.post(process.env.MERCANTIL_API_URL, body, config);
        const data = response.data;

        if (data.transaction_list && Object.values(data.transaction_list).length > 0) {
            return { success: true, data: Object.values(data.transaction_list)[0] };
        }
        return { success: false };

    } catch (error) {
        console.error("Error Banco:", error.message);
        return { success: false };
    }
}

async function getRaffleConfig(raffleId) {
  const doc = await RAFFLES_COLLECTION.doc(raffleId).collection('config').doc('general').get();
  if (!doc.exists) return { 
      totalTickets: 100, ticketPrice: 5, currency: '$', adminPin: '2026',
      raffleTitle: 'Nueva Rifa', verificationMode: 'manual', isClosed: false 
  }; 
  return doc.data();
}

async function checkReferenceExists(raffleId, ref) {
    if (ref === "1234") return false; 
    const snapshot = await RAFFLES_COLLECTION.doc(raffleId).collection('sales')
        .where('ref', '==', ref)
        .where('status', 'in', ['pagado_verificado', 'pendiente_verificacion', 'manual_approved']) 
        .get();
    return !snapshot.empty; 
}

async function getAvailableNumbers(raffleId, totalTickets) {
  const soldList = [];
  const snapshot = await RAFFLES_COLLECTION.doc(raffleId).collection('sales').get();
  snapshot.forEach(doc => {
    const d = doc.data();
    if (d.numbers) soldList.push(...d.numbers);
  });
  const digits = (totalTickets - 1).toString().length;
  const allNumbers = Array.from({length: totalTickets}, (_, i) => i.toString().padStart(digits, '0'));
  return allNumbers.filter(n => !soldList.includes(n));
}

// ==========================================
// 4. ENDPOINTS
// ==========================================

app.get('/', (req, res) => res.send('API SaaS Rifa Activa 🚀'));

// 🔴 ENDPOINT TASA (BCV)
app.get('/api/tasa', async (req, res) => {
    const rate = await getExchangeRate();
    if(rate) res.json({ rate: rate });
    else res.status(500).json({ error: "No se pudo obtener la tasa" });
});

// --- A. MASTER ADMIN ---

app.post('/api/master/config', async (req, res) => {
    try {
        const { softwarePrice, masterPin, bankInfo } = req.body;
        const updateData = {};
        if (softwarePrice) updateData.softwarePrice = parseFloat(softwarePrice);
        if (masterPin) updateData.masterPin = masterPin;
        if (bankInfo) updateData.bankInfo = bankInfo;
        await db.collection('settings').doc('saas_master').set(updateData, { merge: true });
        res.json({ success: true, message: "Guardado" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/master/config', async (req, res) => {
    try {
        const doc = await db.collection('settings').doc('saas_master').get();
        if (!doc.exists) return res.json({ softwarePrice: 50, masterPin: "0000" });
        res.json(doc.data());
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/master/login', async (req, res) => {
    try {
        const { pin } = req.body;
        const doc = await db.collection('settings').doc('saas_master').get();
        const realPin = doc.exists ? (doc.data().masterPin || "0000") : "0000";
        if (pin === realPin) res.json({ success: true });
        else res.status(401).json({ error: "Acceso Denegado" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/master/customers', async (req, res) => {
    try {
        const snapshot = await db.collection('saas_customers').orderBy('purchaseDate', 'desc').get();
        let customers = [];
        snapshot.forEach(doc => customers.push(doc.data()));
        res.json(customers);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- B. VENTA SAAS ---

// A. MÓDULO SAAS (VENTA DEL SOFTWARE) - CON CONVERSIÓN
// ==========================================
// A. MÓDULO SAAS (VENTA DEL SOFTWARE)
// ==========================================
// ==========================================
// A. MÓDULO SAAS (VENTA DEL SOFTWARE)
// ==========================================
app.post('/api/saas/buy', async (req, res) => {
  try {
    const { buyerData, raffleName, paymentRef, amount, paymentDate } = req.body;

    // 1. Validaciones
    if (!buyerData || !raffleName || !paymentRef) {
        return res.status(400).json({ error: "Faltan datos de la compra." });
    }

    // 2. Anti-Doble Gasto
    const refCheck = await db.collection('saas_customers').where('paymentRef', '==', paymentRef).get();
    if (!refCheck.empty) return res.status(409).json({ error: "⛔ Referencia ya utilizada." });

    // 3. Nombre Único
    const newRaffleId = generateId(raffleName);
    const idCheck = await RAFFLES_COLLECTION.doc(newRaffleId).collection('config').doc('general').get();
    if (idCheck.exists) return res.status(409).json({ error: "⛔ Nombre de rifa ya existe." });

    // 4. Calcular Montos
    const currentRate = await getExchangeRate();
    if (!currentRate) return res.status(500).json({ error: "Error Tasa BCV." });

    const amountUSD = parseFloat(amount);
    const amountVES = amountUSD * currentRate;

    // 5. Verificar Pago (Cuenta Maestra)
    const masterCreds = {
        merchantId: process.env.MERCANTIL_MERCHANT_ID,
        clientId: process.env.MERCANTIL_CLIENT_ID,
        secretKey: process.env.MERCANTIL_SECRET_KEY,
        integratorId: process.env.MERCANTIL_INTEGRATOR_ID,
        terminalId: process.env.MERCANTIL_TERMINAL_ID,
        phoneNumber: process.env.MERCANTIL_PHONE_NUMBER
    };

    const dateToCheck = getVenezuelaDate(paymentDate);
    console.log(`Verificando SaaS: Ref ${paymentRef} | Bs. ${amountVES.toFixed(2)}`);

    const bankResult = await verifyMercantilPayment(
        masterCreds, buyerData.ci, buyerData.phone, paymentRef, amountVES, dateToCheck
    );

    if (!bankResult.success) {
        return res.status(402).json({ error: `Pago no encontrado. Se esperaban Bs. ${amountVES.toFixed(2)}` });
    }

    // 6. Crear Instancia
    const adminPin = "2026"; 
    // const adminPin = Math.floor(1000 + Math.random() * 9000).toString(); // Descomenta para PIN aleatorio

    const newConfig = {
        raffleTitle: raffleName,
        companyName: buyerData.companyName || raffleName,
        ownerEmail: buyerData.email,
        ownerPhone: buyerData.phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalTickets: 1000, ticketPrice: 10, currency: "$", adminPin: adminPin,
        isClosed: false, verificationMode: 'manual', plan: "SAAS_LICENSE_V1"
    };

    await RAFFLES_COLLECTION.doc(newRaffleId).collection('config').doc('general').set(newConfig);
    
    await db.collection('saas_customers').doc(newRaffleId).set({
        clientId: newRaffleId, ...buyerData, 
        paymentRef, amountPaidUSD: amountUSD, amountPaidVES: amountVES, exchangeRate: currentRate,
        initialPin: adminPin, purchaseDate: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. ENVIAR CORREOS CON ACCESOS
    
    // ⚠️ IMPORTANTE: Cuando subas a producción, cambia esto por tu dominio Vercel
    // const APP_URL = "https://rifa-corolla.vercel.app";
    const APP_URL = "http://127.0.0.1:5501"; 

    const clientMailOptions = {
        from: `Soporte Software <${process.env.EMAIL_USER}>`,
        to: buyerData.email,
        subject: `🚀 Activado: ${raffleName} - Tus Accesos`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
               <div style="background: #fff; padding: 30px; border-radius: 10px; border-top: 5px solid #13ec5b;">
                  <h1 style="color: #102216; margin-top: 0;">¡Licencia Activada!</h1>
                  <p>Hola <strong>${buyerData.name}</strong>, tu plataforma está lista para usarse.</p>
                  
                  <div style="background: #eefbee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #13ec5b; border-bottom: 1px solid #13ec5b; padding-bottom: 10px;">🔑 TUS CREDENCIALES</h3>
                      
                      <p style="margin-bottom: 5px;"><strong>1. Panel Administrativo (Dashboard):</strong><br>
                      <span style="font-size: 12px; color: #666;">Aquí configuras precios, fotos y ves las ventas.</span><br>
                      <a href="${APP_URL}/admin.html?id=${newRaffleId}" style="color: #007bff; font-weight: bold;">${APP_URL}/admin.html?id=${newRaffleId}</a></p>
                      
                      <p style="margin-bottom: 5px; margin-top: 15px;"><strong>2. Página de Ventas (Público):</strong><br>
                      <span style="font-size: 12px; color: #666;">Comparte este link con tus clientes.</span><br>
                      <a href="${APP_URL}/index.html?id=${newRaffleId}" style="color: #007bff; font-weight: bold;">${APP_URL}/index.html?id=${newRaffleId}</a></p>
                      
                      <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
                      
                      <p style="font-size: 16px;"><strong>PIN DE ACCESO:</strong> <span style="background: #fff; padding: 5px 10px; border-radius: 4px; font-weight: bold; border: 1px solid #ccc;">${adminPin}</span></p>
                  </div>

                  <div style="text-align: center; margin-top: 30px;">
                      <a href="${APP_URL}/manual.html" style="background-color: #102216; color: #fff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; display: inline-block;">
                        📘 Descargar / Ver Manual de Usuario
                      </a>
                  </div>
                  
                  <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Guarda este correo en un lugar seguro.</p>
               </div>
            </div>
        `
    };

    const adminMailOptions = {
        from: `Ventas <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, 
        subject: `💰 VENTA SAAS: $${amountUSD}`,
        html: `
            <h1>Venta Realizada</h1>
            <p><strong>Cliente:</strong> ${buyerData.name}</p>
            <p><strong>ID:</strong> ${newRaffleId}</p>
            <p><strong>Monto:</strong> $${amountUSD} (Bs. ${amountVES.toFixed(2)})</p>
            <p><strong>Ref:</strong> ${paymentRef}</p>
        `
    };
    
    try {
        await Promise.all([
            transporter.sendMail(clientMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);
        console.log("Correos enviados.");
    } catch (e) { console.error("Error email:", e); }

    res.json({ success: true, redirectUrl: `${APP_URL}/admin.html?id=${newRaffleId}` });

  } catch (error) {
    console.error("Error SaaS:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- C. RIFAS CLIENTES ---

app.post('/api/:raffleId/config', async (req, res) => {
  try {
    const { raffleId } = req.params;
    const body = req.body;
    const updateData = {};
    const allowed = [
        'totalTickets', 'ticketPrice', 'currency', 'manualSold', 'images', 
        'adminPin', 'raffleTitle', 'drawCode', 'isClosed', 'verificationMode',
        'bankName', 'bankCode', 'paymentPhone', 'paymentCI', 'companyName', 
        'logoUrl', 'faviconUrl',
        'mercantilMerchantId', 'mercantilClientId', 'mercantilSecretKey', 
        'mercantilIntegratorId', 'mercantilTerminalId', 'mercantilPhone'
    ];
    allowed.forEach(key => { if(body[key] !== undefined) updateData[key] = body[key]; });
    
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No datos" });
    await RAFFLES_COLLECTION.doc(raffleId).collection('config').doc('general').set(updateData, { merge: true });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/:raffleId/config', async (req, res) => {
  const { raffleId } = req.params;
  const config = await getRaffleConfig(raffleId);
  const publicConfig = { ...config };
  delete publicConfig.adminPin; delete publicConfig.mercantilSecretKey; delete publicConfig.mercantilClientId;
  res.json(publicConfig);
});

app.post('/api/:raffleId/admin/login', async (req, res) => {
    try {
        const { raffleId } = req.params;
        const { pin } = req.body;
        const config = await getRaffleConfig(raffleId);
        const currentPin = config.adminPin || "2026";
        if (pin === currentPin) res.json({ success: true });
        else res.status(401).json({ error: "PIN Incorrecto" });
    } catch (error) { res.status(500).json({ error: "Error servidor" }); }
});

// --- COMPRA DE TICKET (LÓGICA PENDIENTE VS VERIFICADO) ---
app.post('/api/:raffleId/comprar', async (req, res) => {
  try {
    const { raffleId } = req.params;
    const { userData, quantity } = req.body;

    // 1. Configuración
    const config = await getRaffleConfig(raffleId);

    if (config.isClosed) return res.status(403).json({ error: "⛔ Sorteo Cerrado." });

    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';
    const MODE = config.verificationMode || 'manual'; 

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    // 2. Seguridad
    const isUsed = await checkReferenceExists(raffleId, userData.ref);
    if (isUsed) return res.status(409).json({ error: 'Referencia ya utilizada.' });

    // 3. Cálculos
    const currentRate = await getExchangeRate();
    const amountUSD = quantity * PRICE;
    const amountVES = amountUSD * (currentRate || 0);
    const dateToCheck = getVenezuelaDate(userData.paymentDate);
    
    let bankResult = { success: false };
    
    // VARIABLES PARA EL CORREO Y ESTADO
    let dbStatus = '';
    let emailSubject = '';
    let emailColor = '';
    let emailTitle = '';
    let emailMessage = '';
    let qrStatus = '';

    // 4. LÓGICA DE MODOS
    if (MODE === 'manual') {
        // --- MODO MANUAL (PENDIENTE) ---
        console.log(`⚠️ MODO MANUAL: Referencia ${userData.ref} puesta en espera.`);
        bankResult = { success: true, data: { trx_type: "manual_report" } };
        
        dbStatus = 'pendiente_verificacion';
        emailSubject = `⏳ REPORTE RECIBIDO: ${config.raffleTitle}`;
        emailColor = '#f59e0b'; // Naranja
        emailTitle = 'PAGO EN REVISIÓN';
        emailMessage = 'Hemos recibido tu reporte de pago. El administrador verificará la transferencia en breve para activar tus tickets.';
        qrStatus = 'PENDIENTE';
        
    } else {
        // --- MODO AUTOMÁTICO (VERIFICADO) ---
        if (!config.mercantilMerchantId) return res.status(500).json({ error: "Banco no configurado." });
        
        const clientCreds = {
            merchantId: config.mercantilMerchantId, clientId: config.mercantilClientId, secretKey: config.mercantilSecretKey,
            integratorId: config.mercantilIntegratorId || process.env.MERCANTIL_INTEGRATOR_ID,
            terminalId: config.mercantilTerminalId || "abcde", phoneNumber: config.mercantilPhone
        };
        
        bankResult = await verifyMercantilPayment(clientCreds, userData.ci, userData.phone, userData.ref, amountVES, dateToCheck);
        
        if (!bankResult.success) return res.status(402).json({ error: 'Pago no encontrado en el banco.' });

        dbStatus = 'pagado_verificado';
        emailSubject = `✅ TICKET CONFIRMADO: ${config.raffleTitle}`;
        emailColor = '#13ec5b'; // Verde
        emailTitle = 'BOLETO DIGITAL';
        emailMessage = '¡Felicidades! Tu pago ha sido verificado exitosamente por el Banco Mercantil.';
        qrStatus = 'VERIFICADO';
    }

    // 5. Asignación de Números
    const available = await getAvailableNumbers(raffleId, TOTAL_TICKETS);
    if (available.length < quantity) return res.status(400).json({ error: `Solo quedan ${available.length} tickets.` });

    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    // 6. Guardar Venta
    const newSale = {
      ...userData,
      ticketsQty: parseInt(quantity),
      totalAmount: amountUSD,
      amountUSD, amountVES, exchangeRate: currentRate,
      currency: CURRENCY,
      raffleTitle: config.raffleTitle || "Gran Rifa",
      drawCode: config.drawCode || "General",
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: dbStatus, // 'pendiente_verificacion' o 'pagado_verificado'
      verificationMethod: MODE,
      bankDetails: bankResult.data || {}
    };

    const docRef = await RAFFLES_COLLECTION.doc(raffleId).collection('sales').add(newSale);

    // 7. Generar QR
    const qrData = `ESTADO: ${qrStatus}\nSorteo: ${newSale.raffleTitle}\nID: ${docRef.id}\n${userData.ci}\nNums: ${assignedNumbers.join(',')}`;
    const qrImage = await QRCode.toDataURL(qrData, { width: 150 });

    // 8. Enviar Correo (Plantilla Dinámica)
    const mailOptions = {
      from: `Rifa <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: emailSubject,
      html: `
        <!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#1a1a1a;"><br><br><div style="max-width:450px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;">
            
            <!-- CABECERA -->
            <div style="background-color:#102216;padding:20px;border-radius:15px 15px 0 0;border-bottom:3px dashed ${emailColor};position:relative;">
               <h2 style="color:#fff;margin:0;text-align:center;text-transform:uppercase;letter-spacing:2px;">${emailTitle}</h2>
               <h1 style="color:${emailColor};margin:5px 0;text-align:center;font-size:24px;">${newSale.raffleTitle}</h1>
               <p style="color:#888;text-align:center;margin:0;font-size:12px;">${newSale.drawCode}</p>
            </div>

            <!-- CUERPO -->
            <div style="background-color:#fdfdfd;padding:30px 25px;border-radius:0 0 15px 15px;position:relative;">
               
               <!-- MENSAJE DE ESTADO -->
               <div style="background-color:${MODE === 'manual' ? '#fff7ed' : '#f0fdf4'}; border:1px solid ${emailColor}; padding:12px; border-radius:8px; margin-bottom:20px; text-align:center;">
                   <p style="margin:0;font-size:13px;color:#333;">${emailMessage}</p>
               </div>

               <div style="text-align:center;margin-bottom:25px;">
                  <p style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">TUS NÚMEROS APARTADOS</p>
                  <div style="border:2px solid #102216;border-radius:10px;padding:15px;background-color:#e8f5e9;">
                      <div style="font-size:32px;font-weight:900;color:#102216;letter-spacing:3px;word-wrap:break-word;">
                        ${assignedNumbers.join(' • ')}
                      </div>
                  </div>
               </div>

               <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;">
                  <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Cliente</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${userData.name}</td></tr>
                  <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Referencia</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${userData.ref}</td></tr>
                  <tr><td style="padding:12px 0 0 0;font-size:16px;font-weight:bold;color:#102216;">TOTAL</td><td style="padding:12px 0 0 0;text-align:right;font-size:18px;font-weight:900;color:#13ec5b;">$${amountUSD.toFixed(2)}</td></tr>
               </table>

               <div style="margin-top:30px;text-align:center;">
                  <img src="cid:qr" style="border:4px solid #102216;border-radius:8px;width:150px;height:150px;">
                  <p style="font-size:10px;margin-top:5px;color:#aaa;">ESTADO: ${qrStatus}</p>
               </div>

            </div><br><br></div></body></html>
      `,
      attachments: [{ filename: 'qrcode.png', path: qrImage, cid: 'qr' }]
    };

    transporter.sendMail(mailOptions).catch(console.error);
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/:raffleId/find-winner', async (req, res) => {
    try {
        const { raffleId } = req.params;
        const { mode, winningNumber } = req.body;
        const salesRef = RAFFLES_COLLECTION.doc(raffleId).collection('sales');
        
        let winnerDoc = null;
        if (mode === 'random') {
            const snapshot = await salesRef.where('status', 'in', ['pagado_verificado', 'manual_approved']).get();
            if (snapshot.empty) return res.status(404).json({ message: "No hay ventas." });
            let allSold = [];
            snapshot.forEach(doc => { const d = doc.data(); if(d.numbers) d.numbers.forEach(n => allSold.push({n, d})); });
            const lucky = allSold[Math.floor(Math.random() * allSold.length)];
            res.json({ found: true, number: lucky.n, client: { name: lucky.d.name, ci: lucky.d.ci, phone: lucky.d.phone, method: lucky.d.verificationMethod, status: lucky.d.status } });
        } else {
            const snapshot = await salesRef.where('numbers', 'array-contains', winningNumber).get();
            if (!snapshot.empty) { const d = snapshot.docs[0].data(); res.json({ found: true, number: winningNumber, client: { name: d.name, ci: d.ci, phone: d.phone, method: d.verificationMethod, status: d.status } }); }
            else res.json({ found: false, number: winningNumber });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- APROBACIÓN MANUAL Y REENVÍO DE CORREO ---
app.post('/api/:raffleId/approve', async (req, res) => {
    try {
        const { raffleId } = req.params;
        const { saleId } = req.body;
        
        // 1. Obtener la venta
        const docRef = RAFFLES_COLLECTION.doc(raffleId).collection('sales').doc(saleId);
        const doc = await docRef.get();
        
        if (!doc.exists) return res.status(404).json({ error: "Venta no encontrada" });
        const saleData = doc.data();

        // Evitar re-aprobar
        if (saleData.status === 'pagado_verificado') return res.json({ success: true, message: "Ya estaba verificado" });

        // 2. Actualizar estado
        await docRef.update({ 
            verificationMethod: 'manual_approved', 
            status: 'pagado_verificado',
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Generar QR Verde (Actualizado)
        const qrData = `ESTADO: VERIFICADO\nSorteo: ${saleData.raffleTitle}\nID: ${saleId}\n${saleData.ci}\nNums: ${saleData.numbers.join(',')}`;
        const qrImage = await QRCode.toDataURL(qrData, { width: 150 });

        // 4. Enviar Correo VERDE (Confirmación)
        const mailOptions = {
            from: `Rifa <${process.env.EMAIL_USER}>`,
            to: saleData.email,
            subject: `✅ PAGO VERIFICADO: ${saleData.raffleTitle}`,
            html: `
                <!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#1a1a1a;"><br><br><div style="max-width:450px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;">
                    <div style="background-color:#102216;padding:20px;border-radius:15px 15px 0 0;border-bottom:3px dashed #13ec5b;position:relative;">
                       <h2 style="color:#fff;margin:0;text-align:center;text-transform:uppercase;letter-spacing:2px;">BOLETO ACTUALIZADO</h2>
                       <h1 style="color:#13ec5b;margin:5px 0;text-align:center;font-size:24px;">PAGO VERIFICADO</h1>
                    </div>
                    <div style="background-color:#fdfdfd;padding:30px 25px;border-radius:0 0 15px 15px;position:relative;">
                       <div style="background-color:#f0fdf4; border:1px solid #13ec5b; padding:12px; border-radius:8px; margin-bottom:20px; text-align:center;">
                           <p style="margin:0;font-size:13px;color:#15803d;font-weight:bold;">El administrador ha confirmado tu transferencia. Tus tickets son oficiales.</p>
                       </div>
                       
                       <div style="text-align:center;margin-bottom:25px;">
                          <p style="color:#666;font-size:10px;text-transform:uppercase;">TUS NÚMEROS</p>
                          <div style="border:2px solid #102216;border-radius:10px;padding:15px;background-color:#e8f5e9;">
                              <div style="font-size:32px;font-weight:900;color:#102216;letter-spacing:3px;">${saleData.numbers.join(' • ')}</div>
                          </div>
                       </div>
                       <div style="margin-top:30px;text-align:center;">
                          <img src="cid:qr" style="border:4px solid #102216;border-radius:8px;width:150px;height:150px;">
                          <p style="font-size:10px;margin-top:5px;color:#aaa;">ESTADO: VERIFICADO</p>
                       </div>
                    </div><br><br></div></body></html>
            `,
            attachments: [{ filename: 'qrcode.png', path: qrImage, cid: 'qr' }]
        };

        transporter.sendMail(mailOptions).catch(console.error);

        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor SaaS Multi-Tenant corriendo en puerto ${PORT}`);
});