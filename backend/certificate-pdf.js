import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildCertificate({ name, certificateId }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

  // Ensure path is correct for your Render environment
  const templatePath = path.join(__dirname, 'public', 'assets', 'certificate-template.png');
  const templateBytes = await fs.readFile(templatePath);
  const backgroundLayout = await pdfDoc.embedPng(templateBytes);

  page.drawImage(backgroundLayout, { x: 0, y: 0, width: 841.89, height: 595.28 });

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const displayName = name.toUpperCase();
  const fontSize = 42;
  const textWidth = font.widthOfTextAtSize(displayName, fontSize);
  
  page.drawText(displayName, {
    x: (841.89 - textWidth) / 2,
    y: 595.28 * 0.515,
    size: fontSize,
    font,
    color: rgb(0.06, 0.18, 0.38),
  });

  // UPDATED URL: /synapse-ai/ID?name=NAME
  const vUrl = `https://visionx-club.in/synapse-ai/${certificateId}?name=${encodeURIComponent(name)}`;
  
  const qrBuffer = await QRCode.toBuffer(vUrl, { 
    margin: 1, 
    color: { dark: '#0a2f74', light: '#ffffff' } 
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  page.drawImage(qrImage, { x: 730, y: 485, width: 75, height: 75 });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function sendEmail(email, name, pdfBuffer) {
  const domain = process.env.RESEND_DOMAIN || 'visionx-club.in'; 
  
  await resend.emails.send({
    from: `VisionX Club <certificates@${domain}>`,
    to: email,
    subject: `Certificate of Achievement: ${name}`,
    html: `<p>Hello <strong>${name}</strong>,</p><p>Congratulations on completing the <strong>Synapse AI</strong> workshop! Your verified certificate is attached below.</p><p>Best Regards,<br>VisionX Club Team</p>`,
    attachments: [
      {
        filename: `${name.replace(/\s+/g, '_')}_Certificate.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}