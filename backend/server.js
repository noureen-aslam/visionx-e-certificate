import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// FIXED: Importing the correct function names from certificate-pdf.js
import { buildCertificate, sendEmail } from './certificate-pdf.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;
const app = express();

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
// Serves static assets if needed
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.post('/generate-certificate', async (req, res) => {
  try {
    const { name, certificateId } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    // Call the correct function
    const pdfBuffer = await buildCertificate({ name, certificateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=VisionX_Certificate.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Download Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/generate-and-send', async (req, res) => {
  try {
    const { name, email, certificateId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Call the correct function
    const pdfBuffer = await buildCertificate({ name, certificateId });

    console.log(`Sending email to ${email}...`);
    await sendEmail(email, name, pdfBuffer);

    return res.json({ success: true, message: "Certificate sent successfully!" });
  } catch (error) {
    console.error('Email Route Error:', error);
    return res.status(500).json({ success: false, detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'active', club: 'VisionX' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VisionX Backend active on port ${PORT}`);
});