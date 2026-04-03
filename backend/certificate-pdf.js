import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

// 1. GENERATE PDF (Using PNG background to ensure design shows)
export async function buildCertificate({ name, email }) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape

    // Load your design (Must be in an 'assets' folder as a PNG)
    const templatePath = path.join(process.cwd(), 'assets', 'certificate-template.png');
    const templateBytes = await fs.readFile(templatePath);
    const backgroundLayout = await pdfDoc.embedPng(templateBytes);

    page.drawImage(backgroundLayout, {
        x: 0, y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
    });

    // Add Name (Centered)
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const displayName = name.toUpperCase();
    const fontSize = 40;
    const textWidth = font.widthOfTextAtSize(displayName, fontSize);
    
    page.drawText(displayName, {
        x: (page.getWidth() - textWidth) / 2,
        y: page.getHeight() * 0.50, // Center-ish height
        size: fontSize,
        font,
        color: rgb(0.06, 0.18, 0.38),
    });

    // Add Dynamic QR Code
    const certId = Math.random().toString(36).substring(7).toUpperCase();
    const qrBuffer = await QRCode.toBuffer(`https://verify.visionxclub.tech/${certId}`, {
        margin: 1,
        color: { dark: '#0a2f74', light: '#ffffff' }
    });
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    page.drawImage(qrImage, {
        x: page.getWidth() - 110,
        y: 45,
        width: 75,
        height: 75,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

// 2. SEND EMAIL
export async function sendEmail(email, name, pdfBuffer) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS 
        }
    });

    await transporter.sendMail({
        from: `"VisionX Club" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Your Participation Certificate - ${name}`,
        html: `<h3>Congratulations ${name}!</h3><p>Attached is your certificate for the Synapse AI workshop.</p>`,
        attachments: [{
            filename: `${name}_VisionX_Certificate.pdf`,
            content: pdfBuffer
        }]
    });
}