import os from 'os';
import fs from 'fs';
import path from 'path';

// Vercel's filesystem is read-only except for the OS temp dir, so uploads must
// land in /tmp there. Local dev keeps a stable ./uploads folder.
export const uploadDir =
  process.env.UPLOAD_DIR ||
  (process.env.VERCEL ? path.join(os.tmpdir(), 'bill-uploads') : path.resolve('uploads'));

export const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};
