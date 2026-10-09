import morgan from 'morgan';
import logger from '../config/logger.js';
import { sanitizeUrl } from '../utils/sanitizeUrl.js';

morgan.token('safeUrl', (req) => sanitizeUrl(req.originalUrl || req.url));

const morganFormat = ':method :safeUrl :status :res[content-length] - :response-time ms';

const morganMiddleware = morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.info(`HTTP ${message.trim()}`);
    }
  }
});

export default morganMiddleware;
