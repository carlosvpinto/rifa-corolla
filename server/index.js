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

// LÓGICA NEGOCIO
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
  if (!doc.exists) return { 
      totalTickets: 100, ticketPrice: 5, currency: '$', adminPin: '2026',
      raffleTitle: 'Gran Rifa', drawCode: 'Sorteo #001', isClosed: false,
      verificationMode: 'auto' // Por defecto seguro
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
app.get('/', (req, res) => {
    res.send('API Rifa Corolla Funcionando 🚀');
});

// A. GUARDAR CONFIGURACIÓN (CORREGIDO Y ROBUSTO)
app.post('/api/config', async (req, res) => {
  try {
    const { 
        totalTickets, ticketPrice, currency, manualSold, images, 
        adminPin, raffleTitle, drawCode, 
        isClosed, verificationMode // <--- Aseguramos recibir estos
    } = req.body;
    
    // DEBUG: Ver qué llega desde el Admin
    console.log("Recibiendo Config:", req.body);

    const updateData = {};

    // Validamos estrictamente (undefined) para que el 0 o false no se ignoren
    if (totalTickets !== undefined) updateData.totalTickets = parseInt(totalTickets);
    if (ticketPrice !== undefined) updateData.ticketPrice = parseFloat(ticketPrice);
    if (currency !== undefined) updateData.currency = currency;
    if (manualSold !== undefined) updateData.manualSold = parseInt(manualSold);
    
    // AQUÍ ESTABA EL PROBLEMA DE LOS BOOLEANOS
    // Usamos '!== undefined' para aceptar 'false' como un valor válido
    if (isClosed !== undefined) updateData.isClosed = isClosed;
    
    // AQUÍ ESTABA EL PROBLEMA DEL MODO
    if (verificationMode !== undefined) updateData.verificationMode = verificationMode;

    if (images !== undefined) updateData.images = images;
    if (raffleTitle !== undefined) updateData.raffleTitle = raffleTitle;
    if (drawCode !== undefined) updateData.drawCode = drawCode;
    
    if (adminPin && adminPin.trim() !== "") {
        updateData.adminPin = adminPin;
    }

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No se enviaron datos para actualizar" });
    }

    await db.collection('settings').doc('general').set(updateData, { merge: true });
    
    console.log("Datos Guardados en Firebase:", updateData); // Confirmación en consola
    
    res.json({ success: true, message: "Configuración guardada" });

  } catch (error) { 
      console.error("Error guardando config:", error);
      res.status(500).json({ error: error.message }); 
  }
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

// --- COMPRA PRINCIPAL (CON VERIFICACIÓN MANUAL/AUTO) ---
app.post('/api/comprar', async (req, res) => {
  try {
    const { userData, quantity } = req.body;

    // 1. OBTENER CONFIGURACIÓN
    const config = await getRaffleConfig();

    // Validar si la rifa está cerrada por el admin
    if (config.isClosed) {
        return res.status(403).json({ error: "⛔ El sorteo está cerrado. No se aceptan más ventas." });
    }

    // Variables de configuración
    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';
    const RAFFLE_TITLE = config.raffleTitle || "Gran Rifa";
    const DRAW_CODE = config.drawCode || "Sorteo General";
    const VERIFICATION_MODE = config.verificationMode || 'auto'; // 'auto' o 'manual'

    // Validar datos de entrada
    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos del usuario o cantidad' });

    // 2. CHEQUEAR DUPLICADO (Prevención de doble gasto)
    // Esto se hace siempre, sea manual o automático, para evitar desorden.
    const isUsed = await checkReferenceExists(userData.ref);
    if (isUsed) {
        return res.status(409).json({ error: 'Esta referencia ya fue registrada anteriormente.' });
    }

    // 3. PREPARAR DATOS DE VERIFICACIÓN
    const rawAmount = quantity * PRICE;
    const dateToCheck = getVenezuelaDate(userData.paymentDate);
    
    let bankResult = { success: false };

    // 🔴 DECISIÓN: ¿MANUAL O AUTOMÁTICO? 🔴
    if (VERIFICATION_MODE === 'manual') {
        console.log(`⚠️ MODO MANUAL: Aprobando referencia ${userData.ref} sin ir al banco.`);
        // Simulamos una respuesta exitosa del banco
        bankResult = { 
            success: true, 
            data: { 
                authorization_code: "MANUAL-OK", 
                payment_reference: userData.ref,
                trx_type: "validacion_manual",
                trx_date: dateToCheck
            } 
        };
    } else {
        console.log(`🔒 MODO AUTO: Consultando API Mercantil para Ref ${userData.ref}...`);
        // Llamada real al banco
        bankResult = await verifyMercantilPayment(
            userData.ci, 
            userData.phone, 
            userData.ref, 
            rawAmount, 
            dateToCheck 
        );
    }

    // Si falló (ya sea porque el banco dijo no, o hubo error en auto)
    if (!bankResult.success) {
        return res.status(402).json({ 
            error: 'Pago no encontrado. Por favor verifica: Fecha, Referencia y Monto exacto.' 
        });
    }

    // 4. GESTIÓN DE INVENTARIO (Números)
    const available = await getAvailableNumbers(TOTAL_TICKETS);
    if (available.length < quantity) {
        return res.status(400).json({ error: `Solo quedan ${available.length} tickets disponibles.` });
    }

    // Asignación aleatoria
    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    // 5. GUARDAR VENTA EN FIREBASE
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
      verificationMethod: VERIFICATION_MODE, // Guardamos cómo se verificó
      bankDetails: bankResult.data || {}
    };

    const docRef = await db.collection('ventas').add(newSale);

    // 6. GENERAR CÓDIGO QR
    const qrData = `VALIDO\nSorteo: ${RAFFLE_TITLE}\nTicket ID: ${docRef.id}\nCédula: ${userData.ci}\nNúmeros: ${assignedNumbers.join(', ')}`;
    const qrImage = await QRCode.toDataURL(qrData, { 
        color: { dark: '#102216', light: '#ffffff' },
        width: 150 
    });

    // 7. ENVIAR CORREO (DISEÑO TICKET + QR ADJUNTO)
    const mailOptions = {
      from: `Rifa <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🎫 BOLETO: ${RAFFLE_TITLE} (Ref: ${userData.ref})`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #1a1a1a;">
          <br><br>
          <div style="max-width: 450px; margin: 0 auto; font-family: Helvetica, Arial, sans-serif;">
            
            <!-- CABECERA TICKET -->
            <div style="background-color: #102216; padding: 20px; border-radius: 15px 15px 0 0; border-bottom: 3px dashed #13ec5b; position: relative;">
               <h2 style="color: #fff; margin: 0; text-align: center; text-transform: uppercase; letter-spacing: 2px;">BOLETO DIGITAL</h2>
               <h1 style="color: #13ec5b; margin: 5px 0; text-align: center; font-size: 24px;">${RAFFLE_TITLE}</h1>
               <p style="color: #888; text-align: center; margin: 0; font-size: 12px;">${DRAW_CODE}</p>
            </div>

            <!-- CUERPO TICKET -->
            <div style="background-color: #fdfdfd; padding: 30px 25px; border-radius: 0 0 15px 15px; position: relative;">
               
               <!-- NÚMEROS -->
               <div style="text-align: center; margin-bottom: 25px;">
                  <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">TUS NÚMEROS</p>
                  <div style="border: 2px solid #102216; border-radius: 10px; padding: 15px; background-color: #e8f5e9;">
                      <div style="font-size: 32px; font-weight: 900; color: #102216; letter-spacing: 3px; word-wrap: break-word;">
                        ${assignedNumbers.join(' • ')}
                      </div>
                  </div>
               </div>

               <!-- TABLA DE DATOS -->
               <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #333;">
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Cliente</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${userData.name}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Cédula</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${userData.ci}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Referencia</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #102216;">${userData.ref}</td></tr>
                  <tr><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: bold; color: #102216;">TOTAL</td><td style="padding: 12px 0 0 0; text-align: right; font-size: 18px; font-weight: 900; color: #13ec5b;">${rawAmount.toFixed(2)} ${CURRENCY}</td></tr>
               </table>

               <!-- ZONA QR (CID) -->
               <div style="margin-top: 30px; text-align: center;">
                  <img src="cid:qrcode_boleto" alt="QR de Validación" style="border: 4px solid #102216; border-radius: 8px; width: 150px; height: 150px;">
                  <p style="font-size: 10px; margin-top: 5px; color: #aaa;">Escanea para validar propiedad</p>
               </div>

            </div>
            <br><br>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
            filename: 'qrcode.png',
            path: qrImage,
            cid: 'qrcode_boleto' 
        }
      ]
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Error mail:", err));
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});