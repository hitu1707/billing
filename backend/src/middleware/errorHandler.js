import logger from '../config/logger.js';
import { sanitizeUrl } from '../utils/sanitizeUrl.js';

const send = (req, res, statusCode, message, errors = null) => {
  const body = { success: false, message, requestId: req.id };
  if (errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
};

const errorHandler = (err, req, res, next) => {
  logger.error(
    `[${req.id}] Error on ${req.method} ${sanitizeUrl(req.originalUrl || req.url)}: ${err.message}`,
    {
      stack: err.stack
    }
  );

  if (err.code === 'LIMIT_FILE_SIZE') {
    return send(req, res, 400, 'File size too large. Maximum allowed size is 10MB.');
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return send(req, res, 400, err.message);
  }

  if (err.name === 'ValidationError') {
    const errorMessages = Object.values(err.errors).map((item) => item.message);
    return send(req, res, 400, 'Validation Error', errorMessages);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return send(req, res, 409, `An account with this ${field} already exists.`);
  }

  // Never echo internal messages: they can contain connection strings or provider details.
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    return send(req, res, statusCode, 'Internal Server Error');
  }
  return send(req, res, statusCode, err.message || 'An error occurred');
};

export default errorHandler;
