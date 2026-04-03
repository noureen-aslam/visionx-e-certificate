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
 * Builds the PDF Buffer. 
 * Automatically detects if the template is PNG or JPG.
 */
export async function buildCertificate({ name, certificateId }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

  const templatePath = path.join(__dirname, 'public', 'assets', 'certificate-template.png');
  console.log("Loading template from:", templatePath);

  let templateBytes;
  try {
    templateBytes = await fs.readFile(templatePath);
    
    // If the file is less than 500 bytes, it's likely a Git LFS pointer, not an image.
    if (templateBytes.length < 500) {
      throw new Error("The image file is corrupted or a Git LFS pointer. Re-upload the actual PNG/JPG.");
    }
  } catch (err) {
    console.error("File Load Error:", err.message);
    throw new Error(`Could not load background: ${err.message}`);
  }

  // SMART EMBEDDING: Try PNG first, then JPG
  let backgroundLayout;
  try {
    backgroundLayout = await pdfDoc.embedPng(templateBytes);
  } catch (pngError) {
    console.log("Not a valid PNG, attempting to load as JPG...");
    try {
      backgroundLayout = await pdfDoc.embedJpg(templateBytes);
    } catch (jpgError) {
      throw new Error("The file is neither a valid PNG nor a valid JPG. Please re-save your design correctly.");
    }
  }

  page.drawImage(backgroundLayout, {
    x: 0, y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const displayName = name.toUpperCase();
  const fontSize = 40;
  const textWidth = font.widthOfTextAtSize(displayName, fontSize);
  
  page.drawText(displayName, {
    x: (page.getWidth() - textWidth) / 2,
    y: page.getHeight() * 0.48, 
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

  page.drawImage(qrImage, {
    x: page.getWidth() - 115,
    y: 45,
    width: 80,
    height: 80,
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
    text: `Hello ${name},\n\nThank you for attending the Synapse AI workshop. Your certificate is attached.\n\nWarm regards,\nVisionX Club`,
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