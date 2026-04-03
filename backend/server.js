import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { buildCertificatePdfBuffer } from './certificate-pdf.js';
import { sendEmail } from './email-sender.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

async function generateCertificateBuffer({ name, certificateId }) {
  console.log('Generating certificate PDF (pdf-lib)...');
  return buildCertificatePdfBuffer({ name, certificateId });
}

app.post('/generate-certificate', async (req, res) => {
  try {
    const { name, certificateId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const pdfBuffer = await generateCertificateBuffer({ name, certificateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=VisionX_Certificate_${String(name).replace(/\s+/g, '_')}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error in /generate-certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate certificate',
      error: error.message,
    });
  }
});

app.post('/generate-and-send', async (req, res) => {
  try {
    const { name, email, certificateId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const pdfBuffer = await generateCertificateBuffer({ name, certificateId });

    console.log('Sending email...');
    await sendEmail(email, pdfBuffer);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /generate-and-send:', error);
    return res.status(500).json({
      message: 'Failed to generate and send certificate',
      detail: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VisionX backend running at http://localhost:${PORT}`);
});
