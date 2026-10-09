import fs from 'fs';
import path from 'path';
import cloudinary from '../config/cloudinary.js';
import logger from '../config/logger.js';
import { signImageFile } from './signImage.js';
import { cloudinaryUploadDuration } from '../middleware/metrics.js';

// Signed URLs work without a session cookie so cross-origin <img> tags keep working.
export const buildLocalImageUrl = (fileName) => {
  const base = (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
  const { exp, sig } = signImageFile(fileName);
  return `${base}/api/bills/image/${encodeURIComponent(fileName)}?e=${exp}&s=${sig}`;
};

export const uploadToCloudinary = async (localFilePath) => {
  const startTime = Date.now();
  const absolutePath = path.resolve(localFilePath);
  const fileName = path.basename(localFilePath);
  const localFallbackUrl = buildLocalImageUrl(fileName);

  // Serverless/ephemeral disks cannot persist receipts, so in production we must
  // fail loudly rather than hand back a local URL that will 404.
  const requireRemote = process.env.NODE_ENV === 'production';

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      if (requireRemote) {
        throw new Error('Image storage is not configured. Set the Cloudinary credentials.');
      }
      logger.info(`Cloudinary not configured. Serving local file: ${localFallbackUrl}`);
      return {
        imageUrl: localFallbackUrl,
        publicId: null
      };
    }

    logger.info(`Uploading image to Cloudinary: ${absolutePath}`);

    const result = await cloudinary.uploader.upload(absolutePath, {
      folder: 'bill-tracker',
      resource_type: 'image',
      transformation: [{ width: 1400, quality: 'auto', fetch_format: 'auto' }]
    });

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    cloudinaryUploadDuration.observe({ status: 'success' }, durationSec);

    logger.info(`Cloudinary upload successful (${durationSec.toFixed(2)}s): ${result.secure_url}`);

    return {
      imageUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    const durationSec = (Date.now() - startTime) / 1000;
    cloudinaryUploadDuration.observe({ status: 'failed' }, durationSec);

    if (requireRemote) {
      logger.error(`Cloudinary upload failed: ${error.message}`);
      throw error;
    }

    logger.warn(`Cloudinary upload failed (${error.message}). Using local image fallback.`);

    return {
      imageUrl: localFallbackUrl,
      publicId: null
    };
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
    logger.info(`Deleted image from Cloudinary: ${publicId}`);
  } catch (error) {
    logger.error(`Cloudinary Delete Error: ${error.message}`);
  }
};
