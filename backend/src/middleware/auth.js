import { errorResponse } from '../utils/responseHandler.js';

export const authenticate = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return errorResponse(res, 401, 'Unauthorized. Please login to continue.');
};
