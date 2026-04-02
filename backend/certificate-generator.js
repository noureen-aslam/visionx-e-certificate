import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function inlineSignatureImages(html) {
  const files = ['signature-smitha.png', 'signature-suhaib.png', 'signature-noureen.png'];
  let out = html;
  for (const file of files) {
    const assetPath = path.join(__dirname, 'public', 'assets', file);
    const buf = await fs.readFile(assetPath);
    const b64 = buf.toString('base64');
    out = out.replaceAll(`{{assetOrigin}}/assets/${file}`, `data:image/png;base64,${b64}`);
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
    return await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

export async function generateCertificate(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required and must be a string');
  }

  const certificateId = crypto.randomUUID();
  const verificationUrl = `https://verify.visionxclub.tech/certificate/${certificateId}`;

  console.log('Generating QR...');
  const qrCode = await QRCode.toDataURL(verificationUrl);

  const templatePath = path.join(__dirname, 'certificate-template.html');
  let template = await fs.readFile(templatePath, 'utf8');

  template = template
    .replace(/{{\s*name\s*}}/g, () => escapeHtml(name))
    .replace(/{{\s*eventDetails\s*}}/g, () => '')
    .replace(/{{\s*date\s*}}/g, () => '1st April 2026')
    .replace(/{{\s*qrCode\s*}}/g, () => qrCode);

  template = await inlineSignatureImages(template);

  return renderPdfFromHtml(template);
}
