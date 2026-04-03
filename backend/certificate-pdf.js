import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

export async function buildCertificate({ name, certificateId }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

  // Points to: backend/public/assets/certificate-template.png (or .jpg)
  const templatePath = path.join(__dirname, 'public', 'assets', 'certificate-template.png');
  
  let templateBytes;
  try {
    templateBytes = await fs.readFile(templatePath);
  } catch (err) {
    throw new Error("Missing background image in public/assets/");
  }

  // Handle both PNG and JPG formats
  let backgroundLayout;
  try {
    backgroundLayout = await pdfDoc.embedPng(templateBytes);
  } catch {
    backgroundLayout = await pdfDoc.embedJpg(templateBytes);
  }

  page.drawImage(backgroundLayout, {
    x: 0, y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const displayName = name.toUpperCase();
  const fontSize = 42;
  const textWidth = font.widthOfTextAtSize(displayName, fontSize);
  
  // --- NAME POSITION (Moved UP to center in the white box) ---
  page.drawText(displayName, {
    x: (page.getWidth() - textWidth) / 2,
    y: page.getHeight() * 0.515, // Adjusted from 0.48 to 0.515
    size: fontSize,
    font,
    color: rgb(0.06, 0.18, 0.38),
  });

  const id = certificateId || Math.random().toString(36).substring(7).toUpperCase();
  const qrBuffer = await QRCode.toBuffer(`https://verify.visionxclub.tech/certificate/${id}`, {
    margin: 1,
    color: { dark: '#0a2f74', light: '#ffffff' }
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  // --- QR CODE POSITION (Moved to TOP RIGHT) ---
  page.drawImage(qrImage, {
    x: page.getWidth() - 110, // Right side
    y: page.getHeight() - 110, // Near the top
    width: 70,
    height: 70,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function sendEmail(email, name, pdfBuffer) {
  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_EMAIL,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken?.token,
    },
  });

  return await transporter.sendMail({
    from: `VisionX Club <${process.env.GMAIL_EMAIL}>`,
    to: email,
    subject: `VisionX Club Certificate – ${name}`,
    text: `Hello ${name},\n\nThank you for attending the Synapse AI workshop. Your certificate is attached.\n\nWarm regards,\nVisionX Club`,
    attachments: [{
      filename: `${name.replace(/\s+/g, '_')}_Certificate.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}