const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// FIREBASE
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// EMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'chatgptecarlosv@gmail.com',
    pass: 'rbcn tcbs rfuj sfki'
  }
});

// --- 1. OBTENER CONFIGURACIÓN (CENTRALIZADA) ---
async function getRaffleConfig() {
  const doc = await db.collection('settings').doc('general').get();
  if (!doc.exists) {
    // Valores por defecto si no se ha configurado nada
    return { 
        totalTickets: 100, 
        ticketPrice: 5, 
        currency: '$' 
    }; 
  }
  return doc.data();
}

// --- 2. LÓGICA DE DISPONIBILIDAD ---
async function getAvailableNumbers(totalTickets) {
  const soldList = [];
  const snapshot = await db.collection('ventas').get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.numbers) soldList.push(...data.numbers);
  });

  // Calcular ceros a la izquierda (Padding)
  const digits = (totalTickets - 1).toString().length;
  const allNumbers = Array.from({length: totalTickets}, (_, i) => 
    i.toString().padStart(digits, '0')
  );
  
  return allNumbers.filter(n => !soldList.includes(n));
}

// --- 3. ENDPOINTS DE CONFIGURACIÓN ---
app.post('/api/config', async (req, res) => {
  try {
    // AHORA RECIBIMOS 'images' TAMBIÉN
    const { totalTickets, ticketPrice, currency, manualSold, images } = req.body;
    
    const updateData = {
        totalTickets: parseInt(totalTickets),
        ticketPrice: parseFloat(ticketPrice),
        currency: currency,
        manualSold: parseInt(manualSold) || 0
    };

    // Solo actualizamos imágenes si se enviaron nuevas (para no borrarlas por error)
    if (images && Array.isArray(images)) {
        updateData.images = images;
    }

    await db.collection('settings').doc('general').set(updateData, { merge: true });

    res.json({ success: true, message: 'Configuración e imágenes actualizadas' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', async (req, res) => {
  const config = await getRaffleConfig();
  res.json(config);
});

// --- 4. ENDPOINT DE COMPRA ---
app.post('/api/comprar', async (req, res) => {
  try {
    const { userData, quantity } = req.body;

    // A. LEEMOS LA CONFIGURACIÓN ACTUAL (PRECIO Y CANTIDAD)
    const config = await getRaffleConfig();
    const TOTAL_TICKETS = parseInt(config.totalTickets) || 100;
    const PRICE = parseFloat(config.ticketPrice) || 5;
    const CURRENCY = config.currency || '$';

    if (!userData || !quantity) return res.status(400).json({ error: 'Faltan datos' });

    // B. DISPONIBILIDAD
    const available = await getAvailableNumbers(TOTAL_TICKETS);
    
    if (available.length < quantity) {
      return res.status(400).json({ error: `Solo quedan ${available.length} números disponibles.` });
    }

    // C. ASIGNAR
    available.sort(() => Math.random() - 0.5);
    const assignedNumbers = available.slice(0, quantity);

    // D. CALCULAR TOTAL CON EL PRECIO DINÁMICO
    const totalCalculated = quantity * PRICE;

    const newSale = {
      ...userData,
      ticketsQty: parseInt(quantity),
      totalAmount: totalCalculated,
      currency: CURRENCY, // Guardamos la moneda usada en ese momento
      numbers: assignedNumbers,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pendiente_verificacion'
    };

    await db.collection('ventas').add(newSale);

    // E. ENVIAR CORREO
    const mailOptions = {
      from: 'Rifa Corolla <chatgptecarlosv@gmail.com>',
      to: userData.email,
      subject: `🎟️ Tus Tickets - Rifa Corolla (Ref: ${userData.ref})`,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f4; padding: 20px;">
          
          <!-- Encabezado -->
          <div style="background-color: #102216; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">GRAN RIFA COROLLA</h2>
            <p style="color: #13ec5b; margin: 5px 0 0 0; font-weight: bold;">¡Gracias por tu compra!</p>
          </div>

          <!-- Cuerpo del Ticket -->
          <div style="background-color: #ffffff; padding: 30px; border-left: 2px dashed #ccc; border-right: 2px dashed #ccc;">
            <p style="font-size: 16px; color: #333;">Hola <strong>${userData.name}</strong>,</p>
            <p style="color: #666;">Hemos registrado exitosamente tu pago móvil con referencia <strong>${userData.ref}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #888; margin-bottom: 10px;">Tus Números de la Suerte</p>
              
              <!-- Burbujas de números -->
              <div style="display: inline-block;">
                ${assignedNumbers.map(num => `
                  <span style="
                    display: inline-block; 
                    background-color: #13ec5b; 
                    color: #102216; 
                    font-weight: bold; 
                    font-size: 24px; 
                    padding: 10px 15px; 
                    border-radius: 50%; 
                    margin: 5px; 
                    border: 2px solid #0ea341;
                  ">${num}</span>
                `).join('')}
              </div>
            </div>

            <table style="width: 100%; font-size: 14px; color: #555; border-top: 1px solid #eee; padding-top: 20px;">
              <tr>
                <td style="padding-bottom: 5px;"><strong>Cédula:</strong> ${userData.ci}</td>
                <td style="text-align: right; padding-bottom: 5px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</td>
              </tr>
              <tr>
                <td><strong>Teléfono:</strong> ${userData.phone}</td>
                <td style="text-align: right;"><strong>Total Pagado:</strong> $${totalCalculated.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <!-- Pie de página -->
          <div style="background-color: #e8e8e8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #777;">
            <p style="margin: 0;">Este correo sirve como comprobante de participación.</p>
            <p style="margin: 5px 0 0 0;">© 2026 Rifa Corolla Sorteo</p>
          </div>
        </div>
      `
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Error mail:", err));
    res.json({ success: true, numbers: assignedNumbers });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});