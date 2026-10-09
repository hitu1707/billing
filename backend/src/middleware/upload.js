import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadDir, ensureUploadDir } from '../config/paths.js';

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bill-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.'), false);
  }
};

// Vercel caps request bodies at ~4.5MB, so default lower there to avoid uploads
// that would be rejected before reaching the function.
const defaultMaxMb = process.env.VERCEL ? 4 : 10;
const maxBytes = (Number(process.env.MAX_UPLOAD_MB) || defaultMaxMb) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxBytes
  }
});

const hasImageSignature = (buffer) => {
  if (buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  return isJpeg || isPng || isWebp;
};

// Verify the real file content (magic bytes), not just the client-supplied extension.
export const validateImageContent = (req, res, next) => {
  if (!req.file) return next();

  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    if (!hasImageSignature(buffer)) {
      fs.unlinkSync(req.file.path);
      const error = new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.');
      error.statusCode = 400;
      return next(error);
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export default upload;
