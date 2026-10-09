import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { errorResponse } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

const isTest = process.env.NODE_ENV === 'test';

// Redis keeps limits shared across replicas and across restarts; without REDIS_URL
// we fall back to the in-memory store.
let redisClient = null;
if (process.env.REDIS_URL && !isTest) {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => logger.warn(`Redis rate-limit store error: ${err.message}`));
    redisClient
      .connect()
      .catch((err) => logger.warn(`Redis rate-limit connection failed: ${err.message}`));
  } catch (err) {
    logger.warn(`Failed to initialize Redis rate-limit client: ${err.message}`);
    redisClient = null;
  }
}

// Each limiter needs its own key namespace, otherwise counters collide on the same key.
const createStore = (prefix) =>
  redisClient
    ? new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args), prefix })
    : undefined;

const buildLimiter = ({ windowMs, limit, message, keyGenerator, skip, storeName }) => {
  const store = createStore(storeName);

  const limiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    keyGenerator,
    skip,
    handler: (req, res) => errorResponse(res, 429, message)
  });

  return (req, res, next) => {
    if (isTest) return next();
    return limiter(req, res, next);
  };
};

export const loginLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message: 'Too many login attempts. Please wait a minute and try again.',
  storeName: 'rl:login:'
});

export const registerLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many signup attempts. Please try again later.',
  storeName: 'rl:register:'
});

export const verifyOtpLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message: 'Too many verification attempts. Please wait a minute and try again.',
  storeName: 'rl:verify-otp:'
});

export const resendOtpLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: 'Too many resend requests. Please wait an hour and try again.',
  storeName: 'rl:resend-otp:'
});

// General API ceiling (DDoS/scrape brake). Signed image reads are excluded, and the
// path prefix is matched after stripping the query so a crafted query string cannot
// exempt other endpoints.
export const apiLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again shortly.',
  skip: (req) => (req.originalUrl || '').split('?')[0].startsWith('/api/bills/image/'),
  storeName: 'rl:api:'
});

// Keyed by user id so upload/scan abuse cannot be dodged by rotating IPs.
export const scanLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  message: 'Upload limit reached. Please try again later.',
  keyGenerator: (req) => req.user._id.toString(),
  storeName: 'rl:scan:'
});
