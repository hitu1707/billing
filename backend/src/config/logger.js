import winston from 'winston';
import path from 'path';
import LokiTransport from 'winston-loki';

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
  new winston.transports.File({
    filename: path.join(process.cwd(), 'src/logs/error.log'),
    level: 'error'
  }),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'src/logs/combined.log')
  }),
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), logFormat)
  })
];

if (process.env.NODE_ENV !== 'test') {
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
