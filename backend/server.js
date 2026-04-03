import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { buildCertificate, sendEmail } from './certificate-pdf.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;
const app = express();

// --- MongoDB Setup ---
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'VisionX_Certificates');
    console.log("✅ Connected to MongoDB: VisionX-Main");
  } catch (e) {
    console.error("❌ MongoDB Connection Failed:", e);
  }
}
connectToDatabase();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.post('/generate-and-send', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Generate a Unique ID for this certificate
    const certificateId = `VX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // 1. Generate the PDF Buffer
    const pdfBuffer = await buildCertificate({ name, certificateId });

    // 2. Save to MongoDB (The Excel-ready data)
    if (db) {
      await db.collection('issued_certificates').insertOne({
        name,
        email,
        certificateId,
        event: "Synapse AI – AI Coding Secrets",
        issuedAt: new Date(),
        status: "Sent"
      });
      console.log(`Saved record for ${name} to Database.`);
    }

    // 3. Send via Email
    await sendEmail(email, name, pdfBuffer);

    return res.json({ success: true, message: "Certificate logged and sent!" });
  } catch (error) {
    console.error('Process Error:', error.message);
    return res.status(500).json({ success: false, detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'active', database: db ? 'connected' : 'offline' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VisionX Backend active on port ${PORT}`);
});