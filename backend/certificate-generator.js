import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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
  await fs.writeFile(tmpPath, htmlWithBase, 'utf8');
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
    await fs.unlink(tmpPath).catch(() => {});
  }
}

export async function generateCertificate(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required and must be a string');
  }

  const certificateId = crypto.randomUUID();
  const templatePath = path.join(__dirname, 'certificate-template.html');
  let template = await fs.readFile(templatePath, 'utf8');

  const escapedName = escapeHtml(name);
  const qrSvg = await QRCode.toString(`https://visionx-club.in/certificate/${certificateId}`, {
    type: 'svg',
    margin: 0,
    width: 112,
    color: { dark: '#0a2f74', light: '#00000000' },
  });

  template = template
    .replace(/{{\s*name\s*}}/g, () => escapedName)
    .replace(/{{\s*eventDetails\s*}}/g, () => '')
    .replace(/{{\s*date\s*}}/g, () => '1st April 2026')
    .replace(/{{\s*qrSvg\s*}}/g, () => qrSvg);

  return renderPdfFromCertificateHtml(template);
}
