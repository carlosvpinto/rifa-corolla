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
// 1. CONFIGURACIÓN
// ==========================================
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// REFERENCIA MAESTRA PARA SAAS (Multi-usuario)
const RAFFLES_COLLECTION = db.collection('raffles');

// EMAIL GLOBAL (La plataforma envía los correos)
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

// ==========================================
// 3. FUNCIONES DINÁMICAS (SAAS)
// ==========================================

// A. Obtener Configuración de un Cliente Específico
async function getRaffleConfig(raffleId) {
    const doc = await RAFFLES_COLLECTION.doc(raffleId).collection('config').doc('general').get();
    
    // Valores por defecto para clientes nuevos
    if (!doc.exists) return { 
        totalTickets: 100, ticketPrice: 5, currency: '$', adminPin: '2026',
        raffleTitle: 'Nueva Rifa', drawCode: 'Sorteo #001', isClosed: false,
        verificationMode: 'manual' 
    }; 
    return doc.data();
}

// B. Verificar Referencia (En la BD del Cliente)
async function checkReferenceExists(raffleId, ref) {
    if (ref === "1234") return false; 
    // Buscamos SOLO en la colección de este cliente
    const snapshot = await RAFFLES_COLLECTION.doc(raffleId).collection('sales')
        .where('ref', '==', ref)
        .where('status', 'in', ['pagado_verificado', 'pendiente_verificacion', 'manual_approved']) 
        .get();
    return !snapshot.empty; 
}

// C. Inventario del Cliente
async function getAvailableNumbers(raffleId, totalTickets) {
  const soldList = [];
  const snapshot = await RAFFLES_COLLECTION.doc(raffleId).collection('sales').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.numbers) soldList.push(...data.numbers);
  });
  const digits = (totalTickets - 1).toString().length;
  const allNumbers = Array.from({length: totalTickets}, (_, i) => i.toString().padStart(digits, '0'));
  return allNumbers.filter(n => !soldList.includes(n));
}

// D. Verificar Pago (Recibe credenciales dinámicas)
async function verifyMercantilPayment(creds, userCi, userPhone, refNumber, rawAmount, paymentDate) {
    const amountString = Number.isInteger(rawAmount) ? rawAmount.toString() : rawAmount.toFixed(2);
    const cleanPhone = formatPhone(userPhone);
    const dateToSend = getVenezuelaDate(paymentDate);

    console.log(`Verificando (${creds.merchantId}): Ref ${refNumber} | Monto ${amountString}`);

    if (refNumber === "1234") return { success: true, data: { trx: "prueba" } }; 

    try {
        const body = {
            merchant_identify: {
                integratorId: parseInt(creds.integratorId),
                merchantId: parseInt(creds.merchantId),
                terminalId: creds.terminalId
            },
            client_identify: {
                ipaddress: '127.0.0.1',
                browser_agent: 'Chrome 18.1.3', 
                mobile: { manufacturer: 'Samsung' }
            },
            search_by: {
                currency: 'ves',
                amount: amountString, 
                destination_mobile_number: encryptMercantil(creds.phoneNumber, creds.secretKey),
                origin_mobile_number: encryptMercantil(cleanPhone, creds.secretKey),
                payment_reference: refNumber,
                trx_date: dateToSend
            }
        };

        const config = {
            headers: { 'Content-Type': 'application/json', 'X-IBM-Client-ID': creds.clientId }
        };

        const response = await axios.post(process.env.MERCANTIL_API_URL, body, config);
        const data = response.data;

        if (data.transaction_list) {
            const transactions = Object.values(data.transaction_list);
            if (transactions.length > 0) return { success: true, data: transactions[0] };
        }
        return { success: false };
    } catch (error) {
        console.error("Error Banco:", error.message);
        return { success: false };
    }
}

// ==========================================
// 4. ENDPOINTS DINÁMICOS (/:raffleId/...)
// ==========================================

app.get('/', (req, res) => res.send('API SaaS Rifa - Activa 🚀'));

// LOGIN ADMIN (Por Cliente)
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

// LEER CONFIGURACIÓN (Por Cliente)
app.get('/api/:raffleId/config', async (req, res) => {
  const { raffleId } = req.params;
  const config = await getRaffleConfig(raffleId);
  const publicConfig = { ...config };
  
  // Seguridad: Borrar claves secretas antes de enviar al frontend
  delete publicConfig.adminPin; 
  delete publicConfig.mercantilSecretKey; 
  delete publicConfig.mercantilClientId;

  res.json(publicConfig);
});

// GUARDAR CONFIGURACIÓN (Por Cliente)
app.post('/api/:raffleId/config', async (req, res) => {
  try {
    const { raffleId } = req.params;
    const body = req.body;
    const updateData = {};

    // Lista blanca de campos permitidos
    const allowed = [
        'totalTickets', 'ticketPrice', 'currency', 'manualSold', 'images', 
        'adminPin', 'raffleTitle', 'drawCode', 'isClosed', 'verificationMode',
        'bankName', 'bankCode', 'paymentPhone', 'paymentCI', 'companyName', 
        'logoUrl', 'faviconUrl',
        // Claves del Banco (Nuevas para SaaS)
        'mercantilMerchantId', 'mercantilClientId', 'mercantilSecretKey', 
        'mercantilIntegratorId', 'mercantilTerminalId', 'mercantilPhone'
    ];

    allowed.forEach(key => { if(body[key] !== undefined) updateData[key] = body[key]; });

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No datos" });

    await RAFFLES_COLLECTION.doc(raffleId).collection('config').doc('general').set(updateData, { merge: true });
    res.json({ success: true, message: "Guardado" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// COMPRA (El corazón del SaaS)
app.post('/api/:raffleId/comprar', async (req, res) => {
  try {
    const { raffleId } = req.params;
    const { userData, quantity } = req.body;

    // 1. Configuración del Cliente
    const config = await getRaffleConfig(raffleId);

    if (config.isClosed) return res.status(403).json({ error: "⛔ Sorteo Cerrado." });

    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';
    const RAFFLE_TITLE = config.raffleTitle || "Gran Rifa";
    const DRAW_CODE = config.drawCode || "Sorteo General";
    const VERIFICATION_MODE = config.verificationMode || 'auto'; 

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    // 2. Duplicados (En BD del cliente)
    const isUsed = await checkReferenceExists(raffleId, userData.ref);
    if (isUsed) return res.status(409).json({ error: 'Referencia ya utilizada.' });

    // 3. Verificación
    const rawAmount = quantity * PRICE;
    const dateToCheck = getVenezuelaDate(userData.paymentDate);
    
    let bankResult = { success: false };

    if (VERIFICATION_MODE === 'manual') {
        bankResult = { success: true, data: { trx_type: "manual", authorization_code: "PENDIENTE" } };
    } else {
        // Usar credenciales del cliente si existen, sino usar las del .env (Tu cuenta maestra)
        const creds = {
            merchantId: config.mercantilMerchantId || process.env.MERCANTIL_MERCHANT_ID,
            clientId: config.mercantilClientId || process.env.MERCANTIL_CLIENT_ID,
            secretKey: config.mercantilSecretKey || process.env.MERCANTIL_SECRET_KEY,
            integratorId: config.mercantilIntegratorId || process.env.MERCANTIL_INTEGRATOR_ID,
            terminalId: config.mercantilTerminalId || process.env.MERCANTIL_TERMINAL_ID,
            phoneNumber: config.mercantilPhone || process.env.MERCANTIL_PHONE_NUMBER
        };
        
        bankResult = await verifyMercantilPayment(creds, userData.ci, userData.phone, userData.ref, rawAmount, dateToCheck);
    }

    if (!bankResult.success) return res.status(402).json({ error: 'Pago no encontrado. Verifica datos.' });

    // 4. Venta
    const available = await getAvailableNumbers(raffleId, TOTAL_TICKETS);
    if (available.length < quantity) return res.status(400).json({ error: `Solo quedan ${available.length} tickets.` });

    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    const newSale = {
      ...userData,
      ticketsQty: parseInt(quantity),
      totalAmount: rawAmount,
      currency: CURRENCY,
      raffleTitle: RAFFLE_TITLE,
      drawCode: DRAW_CODE,
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pagado_verificado',
      verificationMethod: VERIFICATION_MODE, 
      bankDetails: bankResult.data || {}
    };

    // Guardar en colección del cliente
    const docRef = await RAFFLES_COLLECTION.doc(raffleId).collection('sales').add(newSale);

    // QR y Correo
    const qrStatus = VERIFICATION_MODE === 'auto' ? 'VERIFICADO' : 'PENDIENTE';
    const qrData = `ESTADO: ${qrStatus}\nSorteo: ${RAFFLE_TITLE}\nID: ${docRef.id}\n${userData.ci}\nNums: ${assignedNumbers.join(',')}`;
    const qrImage = await QRCode.toDataURL(qrData, { width: 150 });

    const statusColor = VERIFICATION_MODE === 'manual' ? '#f59e0b' : '#13ec5b';
    const statusLabel = VERIFICATION_MODE === 'manual' ? 'REPORTE RECIBIDO' : 'PAGO VERIFICADO';

    const mailOptions = {
      from: `Rifa <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🎫 BOLETO: ${RAFFLE_TITLE}`,
      html: `
        <!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#1a1a1a;"><br><br><div style="max-width:450px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;"><div style="background-color:#102216;padding:20px;border-radius:15px 15px 0 0;border-bottom:3px dashed ${statusColor};position:relative;"><h2 style="color:#fff;margin:0;text-align:center;text-transform:uppercase;letter-spacing:2px;">BOLETO DIGITAL</h2><h1 style="color:${statusColor};margin:5px 0;text-align:center;font-size:24px;">${statusLabel}</h1><p style="color:#888;text-align:center;margin:0;font-size:12px;">${DRAW_CODE}</p></div><div style="background-color:#fdfdfd;padding:30px 25px;border-radius:0 0 15px 15px;position:relative;"><div style="text-align:center;margin-bottom:25px;"><p style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">TUS NÚMEROS</p><div style="border:2px solid #102216;border-radius:10px;padding:15px;background-color:#e8f5e9;"><div style="font-size:32px;font-weight:900;color:#102216;letter-spacing:3px;word-wrap:break-word;">${assignedNumbers.join(' • ')}</div></div></div><table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;"><tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Cliente</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${userData.name}</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Referencia</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${userData.ref}</td></tr><tr><td style="padding:12px 0 0 0;font-size:16px;font-weight:bold;color:#102216;">TOTAL</td><td style="padding:12px 0 0 0;text-align:right;font-size:18px;font-weight:900;color:#13ec5b;">${rawAmount.toFixed(2)} ${CURRENCY}</td></tr></table><div style="margin-top:30px;text-align:center;"><img src="cid:qr" style="border:4px solid #102216;border-radius:8px;width:150px;height:150px;"><p style="font-size:10px;margin-top:5px;color:#aaa;">${qrStatus}</p></div></div><br><br></div></body></html>
      `,
      attachments: [{ filename: 'qrcode.png', path: qrImage, cid: 'qr' }]
    };

    transporter.sendMail(mailOptions).catch(console.error);
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// E. MODULO PREMIACIÓN
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
            snapshot.forEach(doc => {
                const d = doc.data();
                if(d.numbers) d.numbers.forEach(n => allSold.push({n, d}));
            });
            const lucky = allSold[Math.floor(Math.random() * allSold.length)];
            res.json({ found: true, number: lucky.n, client: { name: lucky.d.name, ci: lucky.d.ci, phone: lucky.d.phone, method: lucky.d.verificationMethod, status: lucky.d.status } });
        } else {
            const snapshot = await salesRef.where('numbers', 'array-contains', winningNumber).get();
            if (!snapshot.empty) {
                const d = snapshot.docs[0].data();
                res.json({ found: true, number: winningNumber, client: { name: d.name, ci: d.ci, phone: d.phone, method: d.verificationMethod, status: d.status } });
            } else {
                res.json({ found: false, number: winningNumber });
            }
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// F. MODULO APROBACIÓN
app.post('/api/:raffleId/approve', async (req, res) => {
    try {
        const { raffleId } = req.params;
        const { saleId } = req.body;
        const docRef = RAFFLES_COLLECTION.doc(raffleId).collection('sales').doc(saleId);
        
        const doc = await docRef.get();
        const saleData = doc.data();

        await docRef.update({ verificationMethod: 'manual_approved', status: 'pagado_verificado' });
        
        // Reenviar correo verde (Lógica simplificada, idealmente reusa la función de email)
        // ... (Aquí podrías copiar la lógica de email si quieres reenviar confirmación) ...

        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor SaaS corriendo en puerto ${PORT}`);
});