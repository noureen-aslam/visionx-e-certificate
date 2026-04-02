import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import { sendEmail } from './email-sender.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
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

function injectAssetsBaseHref(html) {
  const baseHref = pathToFileURL(path.join(__dirname, 'public', 'assets') + path.sep).href;
  if (html.includes('<base ')) return html;
  return html.replace('<head>', `<head>\n  <base href="${baseHref}" />`);
}

async function renderPdfFromCertificateHtml(html) {
  const htmlWithBase = injectAssetsBaseHref(html);
  const tmpPath = path.join(
    os.tmpdir(),
    `cert-render-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.html`,
  );
  await fsPromises.writeFile(tmpPath, htmlWithBase, 'utf8');
  const fileUrl = pathToFileURL(tmpPath).href;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: 'load' });
    await waitForImagesReady(page);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    });

    return pdfBuffer;
  } finally {
    await browser.close();
    await fsPromises.unlink(tmpPath).catch(() => {});
  }
}

async function generateCertificateBuffer({ name, eventDetails = {}, date = '1st April 2026', certificateId }) {
  const id = certificateId || crypto.randomUUID();
  const templatePath = path.join(__dirname, 'certificate-template.html');
  let templateHtml = await fsPromises.readFile(templatePath, 'utf8');

  const eventDetailsHtml = serializeEventDetails(eventDetails);
  const qrSvg = await QRCode.toString(`https://visionx-club.in/certificate/${id}`, {
    type: 'svg',
    margin: 0,
    width: 112,
    color: { dark: '#0a2f74', light: '#00000000' },
  });

  templateHtml = templateHtml
    .replace(/{{\s*name\s*}}/g, () => escapeHtml(name))
    .replace(/{{\s*eventDetails\s*}}/g, () => eventDetailsHtml)
    .replace(/{{\s*date\s*}}/g, () => escapeHtml(date))
    .replace(/{{\s*qrSvg\s*}}/g, () => qrSvg);

  return renderPdfFromCertificateHtml(templateHtml);
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
    await sendEmail(email, pdfBuffer);

    return res.json({ success: true, message: 'Certificate generated and email sent successfully' });
  } catch (error) {
    console.error('Error in /generate-and-send:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate and send certificate', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`VisionX backend running at http://localhost:${PORT}`);
});
