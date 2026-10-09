import userService from './user.service.js';
import { successResponse } from '../../utils/responseHandler.js';

// Only these profile fields are ever returned to clients.
const toSafeProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  avatar: user.avatar || null,
  authProvider: user.authProvider
});

class UserController {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.user._id);
      return successResponse(res, 200, 'User profile retrieved successfully', toSafeProfile(profile));
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updatedProfile = await userService.updateProfile(req.user._id, req.body);
      return successResponse(res, 200, 'Profile updated successfully', toSafeProfile(updatedProfile));
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      await userService.deleteAccount(req.user._id);

      req.logout((logoutErr) => {
        if (logoutErr) return next(logoutErr);

        req.session.destroy((sessionErr) => {
          if (sessionErr) return next(sessionErr);
          res.clearCookie('connect.sid');
          return successResponse(res, 200, 'Account and all associated data deleted');
        });
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
