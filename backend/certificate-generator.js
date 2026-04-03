import { buildCertificatePdfBuffer } from './certificate-pdf.js';

export async function generateCertificate(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required and must be a string');
  }
  return buildCertificatePdfBuffer({ name });
}
