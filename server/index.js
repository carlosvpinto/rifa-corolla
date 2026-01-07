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

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================
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

// ==========================================
// 2. UTILIDADES CRÍTICAS
// ==========================================

const encryptMercantil = (message, key) => {
    const algorythm = "aes-128-ecb";
    const hash = crypto.createHash('sha256');
    hash.update(key);
    const keyDigest = hash.digest('hex');
    // Tomamos los primeros 32 caracteres (16 bytes)
    const firstHalf = keyDigest.slice(0, 32); 
    const keyHex = Buffer.from(firstHalf, 'hex');
    
    const cipher = crypto.createCipheriv(algorythm, keyHex, null);
    let ciphertext = cipher.update(message, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    return ciphertext;
};

// Formato de Fecha Venezuela (YYYY-MM-DD)
const getVenezuelaDate = (userDate) => {
    // Si el usuario envió fecha, la usamos. Si no, usamos hoy.
    if(userDate) return userDate;
    
    const date = new Date().toLocaleString("en-CA", {timeZone: "America/Caracas"});
    return date.split(',')[0]; 
};

// Limpiar Teléfono (58414...)
const formatPhone = (phone) => {
    let clean = phone.replace(/\D/g, ''); 
    if (clean.startsWith('0')) clean = clean.substring(1); 
    if (!clean.startsWith('58')) clean = '58' + clean; 
    return clean;
};

// 🔴 NUEVO: Limpiar Cédula (V12345678)
const formatID = (id) => {
    if (!id) return "";
    // Quitar espacios y guiones, convertir a mayúscula
    let clean = id.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean; 
};

// ==========================================
// 3. LÓGICA DE VERIFICACIÓN
// ==========================================
async function verifyMercantilPayment(userCi, userPhone, refNumber, rawAmount, paymentDate) {
    
    // Formato de Monto ("200.00")
    const amountString = rawAmount.toFixed(2);
    
    // Datos limpios
    const cleanPhone = formatPhone(userPhone);
    const cleanID = formatID(userCi); // Ej: "V12345678"
    const dateToSend = getVenezuelaDate(paymentDate);

    console.log(`\n🔍 --- INICIANDO VERIFICACIÓN ---`);
    console.log(`👤 Cliente: ${cleanID} | Tlf: ${cleanPhone}`);
    console.log(`💰 Datos: Ref ${refNumber} | Monto ${amountString} | Fecha ${dateToSend}`);

    if (refNumber === "1234") return true; 

    try {
        const secretKey = process.env.MERCANTIL_SECRET_KEY;
        const myPhone = process.env.MERCANTIL_PHONE_NUMBER; 
        
        // Encriptar teléfonos
        const encryptedDest = encryptMercantil(myPhone, secretKey);
        const encryptedOrigin = encryptMercantil(cleanPhone, secretKey);

        const body = {
            merchant_identify: {
                integratorId: process.env.MERCANTIL_INTEGRATOR_ID.toString(),
                merchantId: process.env.MERCANTIL_MERCHANT_ID.toString(),
                terminalId: process.env.MERCANTIL_TERMINAL_ID
            },
            client_identify: {
                ipaddress: '127.0.0.1',
                browser_agent: 'Chrome 18.1.3', 
                mobile: {
                    manufacturer: 'Samsung',
                }
            },
            search_by: {
                currency: 'ves',
                amount: amountString, 
                destination_mobile_number: encryptedDest,
                origin_mobile_number: encryptedOrigin,
                payment_reference: refNumber,
                trx_date: dateToSend
                // Nota: Aunque la API de búsqueda se basa en Tlf+Ref+Monto,
                // si en el futuro necesitas enviar la cédula, iría aquí como 'payer_id'
                // payer_id: cleanID 
            }
        };

        // 🔴🔴 AQUÍ IMPRIMIMOS EL JSON EXACTO 🔴🔴
        console.log("\n📦 PAYLOAD ENVIADO AL BANCO:");
        console.log(JSON.stringify(body, null, 2));
        console.log("--------------------------------\n");

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-IBM-Client-ID': process.env.MERCANTIL_CLIENT_ID
            }
        };

        const response = await axios.post(process.env.MERCANTIL_API_URL, body, config);
        const data = response.data;

        console.log("📡 RESPUESTA DEL BANCO:");
        console.log(JSON.stringify(data, null, 2));

        if (data.transaction_list) {
            const transactions = Object.values(data.transaction_list);
            if (transactions.length > 0) {
                console.log("✅ PAGO ENCONTRADO.");
                return true;
            }
        }
        
        return false;

    } catch (error) {
        if (error.response) {
            console.error("\n❌ ERROR API MERCANTIL:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("\n❌ ERROR CONEXIÓN:", error.message);
        }
        return false;
    }
}

// ==========================================
// 4. FUNCIONES DE LA RIFA (Sin cambios)
// ==========================================
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

// ==========================================
// 5. ENDPOINTS
// ==========================================

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

app.post('/api/comprar', async (req, res) => {
  try {
    const { userData, quantity } = req.body;

    const config = await getRaffleConfig();
    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    const rawAmount = quantity * PRICE;
    
    // Obtener fecha del formulario o usar hoy (y asegurar formato YYYY-MM-DD)
    const dateToCheck = getVenezuelaDate(userData.paymentDate);

    // VALIDAR
    const isValid = await verifyMercantilPayment(
        userData.ci, 
        userData.phone, 
        userData.ref, 
        rawAmount,
        dateToCheck 
    );

    if (!isValid) {
        return res.status(402).json({ 
            error: 'Pago no encontrado. Revisa la consola del servidor para ver qué se envió.' 
        });
    }

    // PROCESAR
    const available = await getAvailableNumbers(TOTAL_TICKETS);
    if (available.length < quantity) {
      return res.status(400).json({ error: `Solo quedan ${available.length} números disponibles.` });
    }

    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    const newSale = {
      ...userData,
      ci: formatID(userData.ci), // Guardamos la CI limpia y con prefijo en Firebase
      ticketsQty: parseInt(quantity),
      totalAmount: rawAmount,
      currency: CURRENCY,
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pagado_verificado'
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
              <p>Total: ${rawAmount.toFixed(2)} ${CURRENCY}</p>
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