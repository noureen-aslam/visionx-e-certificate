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

const app = express();
const PORT = Number(process.env.PORT) || 5000;

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

// --- Verify Student Route ---
app.post('/verify-student', async (req, res) => {
  try {
    const { rollNumber } = req.body;
    if (!rollNumber) {
      return res.status(400).json({ success: false, message: "Roll number required" });
    }

    const student = await db.collection('verified_attendees').findOne({
      rollNumber: rollNumber.toUpperCase().trim()
    });

    if (student) {
      res.json({ success: true, name: student.name });
    } else {
      res.status(404).json({ success: false, message: "Roll number not found in attendance records." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during verification." });
  }
});

// --- Generate and Send Route (SECURED) ---
app.post('/generate-and-send', async (req, res) => {
  // 🔐 SECURITY CHECK
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.VISIONX_API_KEY) {
    return res.status(403).json({ success: false, message: "Forbidden: Invalid API key" });
  }

  try {
    const { name, email, rollNumber } = req.body;
    const certificateId = `VX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // 1. Build PDF
    const pdfBuffer = await buildCertificate({ name, certificateId });

    // 2. Save Log to Database
    if (db) {
      await db.collection('issued_certificates').insertOne({
        name,
        email,
        rollNumber,
        certificateId,
        event: "Synapse AI – AI Coding Secrets",
        issuedAt: new Date(),
      });
    }

    // 3. Send via Resend
    await sendEmail(email, name, pdfBuffer);

    res.json({ success: true, message: "Certificate sent successfully!" });
  } catch (error) {
    console.error('Process Error:', error.message);
    res.status(500).json({ success: false, detail: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`VisionX Backend active on ${PORT}`)
);
