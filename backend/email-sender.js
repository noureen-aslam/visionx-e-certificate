import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

export async function sendEmail(email, pdfBuffer) {
  if (!email || typeof email !== 'string') {
    throw new Error('email is required');
  }
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('pdfBuffer must be a Buffer');
  }

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
    subject: 'Your VisionX Club Certificate – Synapse AI Workshop',
    text: `Hello ${email},\n\nThank you for attending the Synapse AI – AI Coding Secrets Every Student Should Know workshop hosted by VisionX Club. Your participation is highly valued and contributes to the collaborative spirit of peer-to-peer learning.\n\nPeer-to-peer interactions are essential for building AI coding skills, sharing practical insights, and fostering a supportive growth network. This certificate recognizes your active participation and commitment during the workshop.\n\nPlease find your PDF certificate attached. Congratulations on this achievement, and we look forward to your continued engagement with VisionX Club.\n\nWarm regards,\nVisionX Club`,
    attachments: [
      {
        filename: 'VisionX_Certificate.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}
