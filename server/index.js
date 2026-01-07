const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto'); 
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// UTILIDADES
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

// 🔴 NUEVA FUNCIÓN: Verificar si la referencia ya existe en BD
async function checkReferenceExists(ref) {
    if (ref === "1234") return false; // Permitir 1234 múltiples veces para pruebas
    
    const snapshot = await db.collection('ventas')
        .where('ref', '==', ref)
        .where('status', 'in', ['pagado_verificado', 'pendiente_verificacion']) 
        .get();
        
    return !snapshot.empty; // Retorna TRUE si ya existe
}

// LÓGICA DE VERIFICACIÓN (MODIFICADA PARA RETORNAR DATOS)
async function verifyMercantilPayment(userCi, userPhone, refNumber, rawAmount, paymentDate) {
    const amountString = Number.isInteger(rawAmount) ? rawAmount.toString() : rawAmount.toFixed(2);
    const cleanPhone = formatPhone(userPhone);
    const dateToSend = getVenezuelaDate(paymentDate);

    console.log(`Verificando: Ref ${refNumber} | Monto ${amountString}`);

    // Bypass de prueba (Devuelve datos simulados)
    if (refNumber === "1234") {
        return { 
            success: true, 
            data: { 
                authorization_code: "TEST-123", 
                trx_type: "prueba_sistema" 
            } 
        }; 
    }

    try {
        const body = {
            merchant_identify: {
                integratorId: process.env.MERCANTIL_INTEGRATOR_ID.toString(),
                merchantId: process.env.MERCANTIL_MERCHANT_ID.toString(),
                terminalId: process.env.MERCANTIL_TERMINAL_ID
            },
            client_identify: {
                ipaddress: '127.0.0.1',
                browser_agent: 'Chrome 18.1.3', 
                mobile: { manufacturer: 'Samsung' }
            },
            search_by: {
                currency: 'ves',
                amount: amountString, 
                destination_mobile_number: encryptMercantil(process.env.MERCANTIL_PHONE_NUMBER, process.env.MERCANTIL_SECRET_KEY),
                origin_mobile_number: encryptMercantil(cleanPhone, process.env.MERCANTIL_SECRET_KEY),
                payment_reference: refNumber,
                trx_date: dateToSend
            }
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-IBM-Client-ID': process.env.MERCANTIL_CLIENT_ID
            }
        };

        const response = await axios.post(process.env.MERCANTIL_API_URL, body, config);
        const data = response.data;

        if (data.transaction_list) {
            const transactions = Object.values(data.transaction_list);
            if (transactions.length > 0) {
                // 🔴 ÉXITO: Retornamos TRUE y los DATOS DEL BANCO
                return { success: true, data: transactions[0] };
            }
        }
        
        return { success: false };

    } catch (error) {
        console.error("Error Banco:", error.message);
        return { success: false };
    }
}

// FUNCIONES RIFA
async function getRaffleConfig() {
  const doc = await db.collection('settings').doc('general').get();
  if (!doc.exists) return { totalTickets: 100, ticketPrice: 5, currency: '$' }; 
  return doc.data();
}

async function getAvailableNumbers(totalTickets) {
  const soldList = [];
  const snapshot = await db.collection('ventas').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.numbers) soldList.push(...data.numbers);
  });
  const digits = (totalTickets - 1).toString().length;
  const allNumbers = Array.from({length: totalTickets}, (_, i) => i.toString().padStart(digits, '0'));
  return allNumbers.filter(n => !soldList.includes(n));
}

// ENDPOINTS
app.post('/api/config', async (req, res) => {
  try {
    const { totalTickets, ticketPrice, currency, manualSold, images } = req.body;
    const updateData = {
        totalTickets: parseInt(totalTickets),
        ticketPrice: parseFloat(ticketPrice),
        currency: currency,
        manualSold: parseInt(manualSold) || 0
    };
    if (images) updateData.images = images;
    await db.collection('settings').doc('general').set(updateData, { merge: true });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/config', async (req, res) => {
  const config = await getRaffleConfig();
  res.json(config);
});

// --- COMPRA PRINCIPAL (ACTUALIZADA) ---
app.post('/api/comprar', async (req, res) => {
  try {
    const { userData, quantity } = req.body;

    const config = await getRaffleConfig();
    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    // 1. VALIDAR SI LA REFERENCIA YA SE USÓ (Prevención de Fraude)
    const isUsed = await checkReferenceExists(userData.ref);
    if (isUsed) {
        return res.status(409).json({ // 409 = Conflict
            error: 'Esta referencia bancaria ya fue registrada previamente. No se puede usar dos veces.' 
        });
    }

    // 2. VALIDAR PAGO CON BANCO
    const rawAmount = quantity * PRICE;
    const dateToCheck = getVenezuelaDate(userData.paymentDate);

    const bankResult = await verifyMercantilPayment(
        userData.ci, userData.phone, userData.ref, rawAmount, dateToCheck 
    );

    if (!bankResult.success) {
        return res.status(402).json({ 
            error: 'Pago no encontrado. Verifica Fecha, Referencia y Monto.' 
        });
    }

    // 3. PROCESAR VENTA (Si todo está OK)
    const available = await getAvailableNumbers(TOTAL_TICKETS);
    if (available.length < quantity) {
      return res.status(400).json({ error: `Solo quedan ${available.length} números disponibles.` });
    }

    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    const newSale = {
      ...userData,
      ticketsQty: parseInt(quantity),
      totalAmount: rawAmount,
      currency: CURRENCY,
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pagado_verificado',
      
      // 🔴 GUARDAMOS LOS DATOS DEL BANCO PARA AUDITORÍA 🔴
      bankDetails: bankResult.data || {} 
    };

    await db.collection('ventas').add(newSale);

    const mailOptions = {
      from: `Rifa Corolla <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🎟️ TICKET CONFIRMADO - Rifa Corolla`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
           <div style="background: #fff; padding: 20px; border-radius: 10px; border-top: 5px solid #13ec5b;">
              <h2 style="color: #102216; margin-top: 0;">¡Pago Verificado!</h2>
              <p>Hola <strong>${userData.name}</strong>, el Banco Mercantil ha confirmado tu pago.</p>
              
              <div style="background: #eefbee; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                 <span style="display: block; font-size: 12px; color: #555;">TUS NÚMEROS</span>
                 <strong style="font-size: 24px; color: #102216;">${assignedNumbers.join(' - ')}</strong>
              </div>
              
              <div style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px;">
                <p>Ref: ${userData.ref}</p>
                <p>Auth Banco: ${bankResult.data ? bankResult.data.authorization_code : 'N/A'}</p>
              </div>
           </div>
        </div>
      `
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Error mail:", err));
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});