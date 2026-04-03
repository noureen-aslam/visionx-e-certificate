import crypto from 'crypto';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PDF_PATH = path.join(__dirname, 'certificate-template.pdf');

/**
 * @param {{ name: string, certificateId?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildCertificatePdfBuffer({ name, certificateId }) {
  const trimmed = String(name).trim();
  if (!trimmed) {
    throw new Error('name is required');
  }

  let templateBytes;
  try {
    templateBytes = await fsPromises.readFile(TEMPLATE_PDF_PATH);
  } catch {
    throw new Error(
      'certificate-template.pdf is missing. Place your static certificate PDF in the backend directory as certificate-template.pdf',
    );
  }

  const id = certificateId || crypto.randomUUID();
  const verificationUrl = `https://verify.visionxclub.tech/certificate/${id}`;

  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
  if (!pages.length) {
    throw new Error('certificate-template.pdf has no pages');
  }

  const page = pages[0];
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const displayName = trimmed.toUpperCase();
  const fontSize = Number(process.env.CERT_NAME_FONT_SIZE) || 26;
  const textWidth = font.widthOfTextAtSize(displayName, fontSize);
  const x = (width - textWidth) / 2;
  const nameYRatio = Number(process.env.CERT_NAME_Y_RATIO);
  const nameY =
    Number.isFinite(nameYRatio) && nameYRatio > 0 && nameYRatio < 1
      ? height * nameYRatio
      : height * 0.48;

  page.drawText(displayName, {
    x,
    y: nameY,
    size: fontSize,
    font,
    color: rgb(0.067, 0.176, 0.38),
  });

  console.log('Generating QR PNG for PDF...');
  const qrPngBuffer = await QRCode.toBuffer(verificationUrl, {
    type: 'png',
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a2f74', light: '#ffffffff' },
  });

  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const qrSize = Number(process.env.CERT_QR_SIZE_PT) || 72;
  const qrMargin = Number(process.env.CERT_QR_MARGIN_PT) || 18;

  page.drawImage(qrImage, {
    x: width - qrSize - qrMargin,
    y: qrMargin,
    width: qrSize,
    height: qrSize,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
