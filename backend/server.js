import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// FIXED: Importing the correct function name 'buildCertificate'
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
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Helper to keep logic clean
async function generateBuffer({ name, certificateId }) {
  console.log('Building PDF buffer...');
  return await buildCertificate({ name, certificateId });
}

app.post('/generate-certificate', async (req, res) => {
  try {
    const { name, certificateId } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const pdfBuffer = await generateBuffer({ name, certificateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Certificate.pdf`,
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
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const pdfBuffer = await generateBuffer({ name, certificateId });

    console.log(`Sending email to ${email}...`);
    await sendEmail(email, name, pdfBuffer);

    return res.json({ success: true, message: "Email sent!" });
  } catch (error) {
    console.error('Email Route Error:', error);
    return res.status(500).json({ success: false, detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VisionX Backend active on port ${PORT}`);
});