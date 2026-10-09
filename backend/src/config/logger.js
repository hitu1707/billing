import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';
import LokiTransport from 'winston-loki';

// Vercel's filesystem is read-only except for the OS temp dir, so file logs
// land in /tmp there. Local dev keeps the stable ./src/logs folder.
const logDir =
  process.env.LOG_DIR ||
  (process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'src/logs'));

try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // Falls back to console-only logging if the directory cannot be created.
}

// Redact PII and credentials before anything reaches a log sink.
const REDACTIONS = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED]'],
  [
    /\b(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s'"`]+/gi,
    (match) => match.replace(/\/\/([^:/@\s]+)(:[^@\s]*)?@/, '//$1[REDACTED]@')
  ],
  [
    /([?&](?:key|token|secret|password|apikey|api_key)=)[^&\s'"`]+/gi,
    '$1[REDACTED]'
  ]
];

const redact = (text) => {
  if (typeof text !== 'string') return text;
  let output = text;
  for (const [pattern, replacement] of REDACTIONS) {
    output = output.replace(pattern, replacement);
  }
  return output;
};

const redactSensitive = winston.format((info) => {
  info.message = redact(info.message);
  if (info.stack) info.stack = redact(info.stack);
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  redactSensitive(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), logFormat)
  })
];

let fileLoggingEnabled = true;
try {
  fs.accessSync(logDir, fs.constants.W_OK);
} catch {
  fileLoggingEnabled = false;
}

if (fileLoggingEnabled) {
  transports.unshift(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  );
}

// Loki only runs in the local monitoring stack, never on Vercel.
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  transports.push(
    new LokiTransport({
      host: 'http://127.0.0.1:3100',
      labels: { app: 'bill-tracker-backend' },
      json: true,
      batching: false,
      gracefulShutdown: true,
      // Swallow connection errors so the app keeps running if Loki is down.
      onConnectionError: (err) => {}
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports
});

export default logger;
