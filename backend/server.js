import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { buildCertificate, sendEmail } from './certificate-pdf.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.post('/generate-and-send', async (req, res) => {
  try {
    const { name, email, certificateId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Generate PDF
    const pdfBuffer = await buildCertificate({ name, certificateId });

    // Send Email
    console.log(`Sending certificate to ${email}...`);
    await sendEmail(email, name, pdfBuffer);

    return res.json({ success: true, message: "Certificate sent successfully!" });
  } catch (error) {
    console.error('Email Route Error:', error.message);
    return res.status(500).json({ success: false, detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'active', club: 'VisionX' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VisionX Backend active on port ${PORT}`);
});