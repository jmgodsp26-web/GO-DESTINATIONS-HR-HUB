import { MAX_FILE_BYTES } from '../src/utils/files.js';
export function decodeUpload(value: unknown): { mime: string; bytes: Buffer } {
  if (typeof value !== 'string') throw new Error('Select a file to upload (up to 450 KB).');
  if (value.length > 600200) throw new Error('File exceeds the allowed limit (450 KB).');
  const match = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) throw new Error('Invalid file upload. Select the file again (up to 450 KB).');
  const mime = match[1].toLowerCase();
  const allowed = ['application/pdf','image/png','image/jpeg','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'];
  if (!allowed.includes(mime)) throw new Error('Use a PDF, image, Word, Excel, or text document.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || bytes.toString('base64') !== match[2]) throw new Error('Invalid file or file exceeds 450 KB.');
  return { mime, bytes };
}
