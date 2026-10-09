import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import connectDB from './config/db.js';
import passport from './config/passport.js';
import morganMiddleware from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import { errorResponse, successResponse } from './utils/responseHandler.js';
import { sanitizeUrl } from './utils/sanitizeUrl.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import register, { metricsMiddleware, activeSessionsGauge } from './middleware/metrics.js';

import authRoutes from './modules/auth/auth.routes.js';
import billRoutes from './modules/bill/bill.routes.js';
import userRoutes from './modules/user/user.routes.js';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Fail fast when required configuration is missing.
if (!process.env.MONGODB_URI) {
  throw new Error('CRITICAL: MONGODB_URI environment variable must be set');
}

if (isProduction) {
  const required = [
    'SESSION_SECRET',
    'CLIENT_URL',
    'GEMINI_API_KEY',
    'EMAIL_USER',
    'EMAIL_PASS',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`CRITICAL: missing required environment variables in production: ${missing.join(', ')}`);
  }

  const uri = process.env.MONGODB_URI;
  const usesTls = uri.startsWith('mongodb+srv://') || /[?&](tls|ssl)=true/i.test(uri);
  if (!usesTls) {
    throw new Error('CRITICAL: MONGODB_URI must use TLS/SSL in production (mongodb+srv:// or ?tls=true)');
  }
}

const sessionSecret = process.env.SESSION_SECRET || crypto.randomUUID();

if (isProduction) {
  // Must match the real number of proxy hops in front of the app, otherwise
  // X-Forwarded-For can be spoofed for rate limiting / secure-cookie decisions.
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  })
);

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure a live DB connection per request (cached across warm invocations).
// /api/health reports DB state instead of failing, so it is excluded.
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use(metricsMiddleware);

if (process.env.NODE_ENV !== 'test') {
  app.use(morganMiddleware);
}

// Local bill images are served only through the signed route
// GET /api/bills/image/:fileName, never as static files.

const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  ttl: 14 * 24 * 60 * 60
});

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Refreshed on scrape (no long-lived timers in serverless).
const updateSessionGauge = () =>
  new Promise((resolve) => {
    sessionStore.length((err, count) => {
      if (!err && typeof count === 'number') activeSessionsGauge.set(count);
      resolve();
    });
  });

app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  return successResponse(res, dbUp ? 200 : 503, 'Bill Tracker API is live and healthy 🚀', {
    database: dbUp ? 'up' : 'down'
  });
});

// Metrics are exposed only to the real TCP peer or a token holder. req.ip is
// not used because it can be spoofed via X-Forwarded-For when trust proxy is set.
const metricsAuth = (req, res, next) => {
  if (!isProduction) return next();

  const token = process.env.METRICS_TOKEN;
  const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const peer = req.socket?.remoteAddress;
  if (localIps.includes(peer) || (token && req.get('x-metrics-token') === token)) {
    return next();
  }
  return errorResponse(res, 404, 'Not found');
};

app.get('/metrics', metricsAuth, async (req, res) => {
  await updateSessionGauge();
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => {
  return errorResponse(res, 404, `Route ${req.method} ${sanitizeUrl(req.originalUrl)} not found`);
});

app.use(errorHandler);

export default app;
