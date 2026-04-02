import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import { sendEmail } from './email-sender.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5000;

const app = express();

// ✅ CORS setup — allows your Vercel frontend to call the backend
app.use(
  cors({
    origin: '*', // allow all origins; you can restrict to your Vercel domain later
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

function serializeEventDetails(eventDetails) {
  if (!eventDetails) return '';
  if (typeof eventDetails === 'string') return eventDetails;
  if (typeof eventDetails === 'object') {
    return Object.entries(eventDetails)
      .map(([key, value]) => `<strong>${key}:</strong> ${String(value)}`)
      .join('<br>');
  }
  return String(eventDetails);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function waitForImagesReady(page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map(
        (img) =>
          img.complete && img.naturalHeight > 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                const done = () => resolve();
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
              }),
      ),
    ),
  );
}

/** Embed signature PNGs as data URLs so PDF render works on Render without self-HTTP fetches. */
async function inlineSignatureImages(html) {
  const files = ['signature-smitha.png', 'signature-suhaib.png', 'signature-noureen.png'];
  let out = html;
  for (const file of files) {
    const assetPath = path.join(__dirname, 'public', 'assets', file);
    try {
      const buf = await fsPromises.readFile(assetPath);
      const b64 = buf.toString('base64');
      out = out.replaceAll(`{{assetOrigin}}/assets/${file}`, `data:image/png;base64,${b64}`);
    } catch (e) {
      console.error('Missing signature asset:', file, e.message);
      throw new Error(`Certificate asset not found: ${file}`);
    }
  }
  return out;
}

async function renderPdfFromHtml(html) {
  console.log('Launching browser...');
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',            // ✅ required for Render
      '--disable-setuid-sandbox',// ✅ required for Render
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });
    await waitForImagesReady(page);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );

    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

async function generateCertificateBuffer({ name, eventDetails = {}, date = '1st April 2026', certificateId }) {
  const id = certificateId || crypto.randomUUID();
  const verificationUrl = `https://verify.visionxclub.tech/certificate/${id}`;

  console.log('Generating QR...');
  const qrCode = await QRCode.toDataURL(verificationUrl);

  const templatePath = path.join(__dirname, 'certificate-template.html');
  let templateHtml = await fsPromises.readFile(templatePath, 'utf8');

  const eventDetailsHtml = serializeEventDetails(eventDetails);

  templateHtml = templateHtml
    .replace(/{{\s*name\s*}}/g, () => escapeHtml(name))
    .replace(/{{\s*eventDetails\s*}}/g, () => eventDetailsHtml)
    .replace(/{{\s*date\s*}}/g, () => escapeHtml(date))
    .replace(/{{\s*qrCode\s*}}/g, () => qrCode);

  templateHtml = await inlineSignatureImages(templateHtml);

  return renderPdfFromHtml(templateHtml);
}

app.post('/generate-certificate', async (req, res) => {
  try {
    const { name, eventDetails = {}, date = '1st April 2026', certificateId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const pdfBuffer = await generateCertificateBuffer({ name, eventDetails, date, certificateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=VisionX_Certificate_${name.replace(/\s+/g, '_')}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error in /generate-certificate:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate certificate', error: error.message });
  }
});

app.post('/generate-and-send', async (req, res) => {
  try {
    const { name, email, eventDetails = {}, date = '1st April 2026', certificateId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const pdfBuffer = await generateCertificateBuffer({ name, eventDetails, date, certificateId });

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
