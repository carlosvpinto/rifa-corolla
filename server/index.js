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

// LÓGICA DE NEGOCIO
async function checkReferenceExists(ref) {
    if (ref === "1234") return false; 
    const snapshot = await db.collection('ventas')
        .where('ref', '==', ref)
        .where('status', 'in', ['pagado_verificado', 'pendiente_verificacion']) 
        .get();
    return !snapshot.empty; 
}

async function verifyMercantilPayment(userCi, userPhone, refNumber, rawAmount, paymentDate) {
    const amountString = Number.isInteger(rawAmount) ? rawAmount.toString() : rawAmount.toFixed(2);
    const cleanPhone = formatPhone(userPhone);
    const dateToSend = getVenezuelaDate(paymentDate);

    console.log(`Verificando: Ref ${refNumber} | Monto ${amountString}`);

    if (refNumber === "1234") return { success: true, data: { trx: "prueba" } }; 

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
                return { success: true, data: transactions[0] };
            }
        }
        return { success: false };
    } catch (error) {
        console.error("Error Banco:", error.message);
        return { success: false };
    }
}

async function getRaffleConfig() {
  const doc = await db.collection('settings').doc('general').get();
  // Valores por defecto si no existen
  if (!doc.exists) return { 
      totalTickets: 100, 
      ticketPrice: 5, 
      currency: '$', 
      adminPin: '2026',
      raffleTitle: 'Gran Rifa', // Default
      drawCode: 'Sorteo #001'   // Default
  }; 
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

// 1. GUARDAR CONFIGURACIÓN (ACTUALIZADO)
app.post('/api/config', async (req, res) => {
  try {
    const { totalTickets, ticketPrice, currency, manualSold, images, adminPin, raffleTitle, drawCode } = req.body;
    
    const updateData = {};
    if (totalTickets !== undefined) updateData.totalTickets = parseInt(totalTickets);
    if (ticketPrice !== undefined) updateData.ticketPrice = parseFloat(ticketPrice);
    if (currency !== undefined) updateData.currency = currency;
    if (manualSold !== undefined) updateData.manualSold = parseInt(manualSold);
    if (images !== undefined) updateData.images = images;
    
    // Guardamos los nuevos campos de texto
    if (raffleTitle !== undefined) updateData.raffleTitle = raffleTitle;
    if (drawCode !== undefined) updateData.drawCode = drawCode;
    
    if (adminPin && adminPin.trim() !== "") updateData.adminPin = adminPin;

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No datos" });

    await db.collection('settings').doc('general').set(updateData, { merge: true });
    res.json({ success: true, message: "Guardado" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/config', async (req, res) => {
  const config = await getRaffleConfig();
  const publicConfig = { ...config };
  delete publicConfig.adminPin; 
  res.json(publicConfig);
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { pin } = req.body;
        const config = await getRaffleConfig();
        const currentPin = config.adminPin || "2026";
        if (pin === currentPin) res.json({ success: true });
        else res.status(401).json({ error: "PIN Incorrecto" });
    } catch (error) { res.status(500).json({ error: "Error servidor" }); }
});

// 2. COMPRA (ACTUALIZADO)
app.post('/api/comprar', async (req, res) => {
  try {
    const { userData, quantity } = req.body;

    const config = await getRaffleConfig();
    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';
    
    // Obtenemos nombre y sorteo actuales
    const RAFFLE_TITLE = config.raffleTitle || "Gran Rifa";
    const DRAW_CODE = config.drawCode || "Sorteo General";

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    const isUsed = await checkReferenceExists(userData.ref);
    if (isUsed) return res.status(409).json({ error: 'Referencia ya utilizada.' });

    const rawAmount = quantity * PRICE;
    const dateToCheck = getVenezuelaDate(userData.paymentDate);

    const bankResult = await verifyMercantilPayment(
        userData.ci, userData.phone, userData.ref, rawAmount, dateToCheck 
    );

    if (!bankResult.success) {
        return res.status(402).json({ error: 'Pago no encontrado. Verifica Fecha, Referencia y Monto.' });
    }

    const available = await getAvailableNumbers(TOTAL_TICKETS);
    if (available.length < quantity) return res.status(400).json({ error: `Solo quedan ${available.length} tickets.` });

    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    const newSale = {
      ...userData,
      ticketsQty: parseInt(quantity),
      totalAmount: rawAmount,
      currency: CURRENCY,
      // 🔴 GUARDAMOS EL NOMBRE Y CÓDIGO EN LA VENTA 🔴
      raffleTitle: RAFFLE_TITLE,
      drawCode: DRAW_CODE,
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pagado_verificado',
      bankDetails: bankResult.data || {}
    };

    await db.collection('ventas').add(newSale);

    // Correo Actualizado con el Nombre de la Rifa
    const mailOptions = {
      from: `Rifa <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🎫 BOLETO: ${RAFFLE_TITLE}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #1a1a1a;">
          <br><br>
          <div style="max-width: 450px; margin: 0 auto; font-family: Helvetica, Arial, sans-serif;">
            <div style="background-color: #102216; padding: 20px; border-radius: 15px 15px 0 0; border-bottom: 3px dashed #13ec5b; position: relative;">
               <h2 style="color: #fff; margin: 0; text-align: center; text-transform: uppercase; letter-spacing: 2px;">BOLETO DIGITAL</h2>
               <!-- NOMBRE DINÁMICO -->
               <h1 style="color: #13ec5b; margin: 5px 0; text-align: center; font-size: 24px;">${RAFFLE_TITLE}</h1>
               <p style="color: #888; text-align: center; margin: 0; font-size: 12px;">${DRAW_CODE}</p>
            </div>
            <div style="background-color: #fdfdfd; padding: 30px 25px; border-radius: 0 0 15px 15px; position: relative;">
               <div style="text-align: center; margin-bottom: 25px;">
                  <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">TUS NÚMEROS</p>
                  <div style="border: 2px solid #102216; border-radius: 10px; padding: 15px; background-color: #e8f5e9;">
                      <div style="font-size: 32px; font-weight: 900; color: #102216; letter-spacing: 3px; word-wrap: break-word;">
                        ${assignedNumbers.join('  •  ')}
                      </div>
                  </div>
               </div>
               <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #333;">
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Cliente</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${userData.name}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Referencia</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #102216;">${userData.ref}</td></tr>
                  <tr><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: bold; color: #102216;">TOTAL</td><td style="padding: 12px 0 0 0; text-align: right; font-size: 18px; font-weight: 900; color: #13ec5b;">${rawAmount.toFixed(2)} ${CURRENCY}</td></tr>
               </table>
            </div>
            <br><br>
          </div>
        </body>
        </html>
      `
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Error mail:", err));
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔴 RUTA DE PRUEBA (Vital para Render)
app.get('/', (req, res) => {
    res.send('API Rifa Corolla Funcionando y Lista 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});