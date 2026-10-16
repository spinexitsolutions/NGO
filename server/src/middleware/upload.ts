import multer from 'multer';
import { env } from '../config/env.js';

/** Files are buffered in memory, then content-sniffed and re-encoded before storage. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
});

export const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

/** Magic-byte detection — never trust the client-supplied MIME type or extension. */
export function sniff(buf: Buffer): { mime: string; ext: string; kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT' } | null {
  const hex = buf.subarray(0, 16).toString('hex');
  const ascii = buf.subarray(0, 16).toString('latin1');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg', kind: 'IMAGE' };
  if (hex.startsWith('89504e470d0a1a0a')) return { mime: 'image/png', ext: 'png', kind: 'IMAGE' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp', kind: 'IMAGE' };
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return { mime: 'image/gif', ext: 'gif', kind: 'IMAGE' };
  if (ascii.slice(4, 12) === 'ftypavif') return { mime: 'image/avif', ext: 'avif', kind: 'IMAGE' };
  if (ascii.slice(4, 8) === 'ftyp') return { mime: 'video/mp4', ext: 'mp4', kind: 'VIDEO' };
  if (hex.startsWith('1a45dfa3')) return { mime: 'video/webm', ext: 'webm', kind: 'VIDEO' };
  if (ascii.startsWith('%PDF-')) return { mime: 'application/pdf', ext: 'pdf', kind: 'DOCUMENT' };
  return null; // SVG, HTML, executables etc. are rejected
}
