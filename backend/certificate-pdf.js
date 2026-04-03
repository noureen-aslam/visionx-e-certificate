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

// --- OAuth2 Configuration ---
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

/**
 * Builds the PDF Buffer
 * Moves Name into the white box and QR Code to the top-right.
 */
export async function buildCertificate({ name, certificateId }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

  // Points to: backend/public/assets/certificate-template.png
  const templatePath = path.join(__dirname, 'public', 'assets', 'certificate-template.png');
  
  let templateBytes;
  try {
    templateBytes = await fs.readFile(templatePath);
  } catch (err) {
    console.error("Template load error:", err.message);
    throw new Error("Missing background image in public/assets/");
  }

  // Handle both PNG and JPG formats automatically
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
  
  // --- NAME POSITION (Centered inside the white box) ---
  page.drawText(displayName, {
    x: (page.getWidth() - textWidth) / 2,
    y: page.getHeight() * 0.515, // Pushes text UP into the box
    size: fontSize,
    font,
    color: rgb(0.06, 0.18, 0.38),
  });

  // --- SMART QR CODE GENERATION ---
  const id = certificateId || Math.random().toString(36).substring(7).toUpperCase();
  
  // This URL points to your Vercel app with the 'verify' and 'name' parameters
  const verificationUrl = `https://visionx-club-eight.vercel.app?verify=${id}&name=${encodeURIComponent(name)}`;

  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    margin: 1,
    width: 200,
    color: { dark: '#0a2f74', light: '#ffffff' }
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  // --- QR CODE POSITION (Top Right Corner) ---
  page.drawImage(qrImage, {
    x: page.getWidth() - 110, 
    y: page.getHeight() - 110, 
    width: 75,
    height: 75,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Sends Email via OAuth2
 */
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

  const mailOptions = {
    from: `VisionX Club <${process.env.GMAIL_EMAIL}>`,
    to: email,
    subject: `VisionX Club Certificate – ${name}`,
    text: `Hello ${name},\n\nThank you for attending the Synapse AI workshop. Your official certificate is attached below.\n\nWarm regards,\nVisionX Club Team`,
    attachments: [
      {
        filename: `${name.replace(/\s+/g, '_')}_Certificate.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  return await transporter.sendMail(mailOptions);
}