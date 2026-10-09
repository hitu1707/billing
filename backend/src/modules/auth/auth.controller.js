import { authEventCounter } from '../../middleware/metrics.js';
import passport from '../../config/passport.js';
import authService from './auth.service.js';
import User from '../../models/User.js';
import { sendOtpEmail } from '../../utils/emailService.js';
import { successResponse, errorResponse } from '../../utils/responseHandler.js';
import { generateOtp, hashOtp, verifyOtpHash } from '../../utils/otp.js';
import logger from '../../config/logger.js';

const MAX_OTP_ATTEMPTS = 5;

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        return errorResponse(res, 400, 'Name, email, and password are required fields');
      }

      if (password.length < 8) {
        return errorResponse(res, 400, 'Password must be at least 8 characters long');
      }

      if (password.length > 72) {
        return errorResponse(res, 400, 'Password must be at most 72 characters long');
      }

      const { user, alreadyExists } = await authService.register({ name, email, password, phone });

      // Anti-enumeration: existing and new accounts get the same response, and an
      // existing account is never auto-logged-in or emailed.
      const genericMessage = 'Account created. Check your email for a 6-digit verification code.';
      if (alreadyExists) {
        authEventCounter.inc({ action: 'register', provider: 'local', status: 'exists' });
        return successResponse(res, 201, genericMessage, {
          requiresOtp: true,
          email: user.email
        });
      }

      // Registration no longer starts a session: the account must verify its email.
      const otpCode = generateOtp();
      user.otpCode = hashOtp(otpCode);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      user.otpAttempts = 0;
      await user.save();

      await sendOtpEmail(user.email, otpCode, user.name);

      authEventCounter.inc({ action: 'register', provider: 'local', status: 'success' });

      return successResponse(res, 201, genericMessage, {
        requiresOtp: true,
        email: user.email
      });
    } catch (error) {
      authEventCounter.inc({ action: 'register', provider: 'local', status: 'failed' });
      next(error);
    }
  }

  // Email + password, then a 6-digit OTP is emailed.
  async login(req, res, next) {
    passport.authenticate('local', async (err, user, info) => {
      try {
        if (err) return next(err);

        if (!user) {
          authEventCounter.inc({ action: 'login', provider: 'local', status: 'failed' });
          return errorResponse(res, 401, info?.message || 'Invalid email or password');
        }

        const otpCode = generateOtp();
        user.otpCode = hashOtp(otpCode);
        user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        user.otpAttempts = 0;
        await user.save();

        await sendOtpEmail(user.email, otpCode, user.name);

        authEventCounter.inc({ action: 'otp_sent', provider: 'local', status: 'success' });

        return successResponse(res, 200, 'Verification code sent to your email', {
          requiresOtp: true,
          email: user.email
        });
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  }

  async googleOauthSuccess(req, res, next) {
    try {
      const user = req.user;
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      if (!user) {
        authEventCounter.inc({ action: 'oauth', provider: 'google', status: 'failed' });
        return res.redirect(`${clientUrl}/login?error=oauth_failed`);
      }

      const otpCode = generateOtp();
      user.otpCode = hashOtp(otpCode);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      user.otpAttempts = 0;
      await user.save();

      await sendOtpEmail(user.email, otpCode, user.name);

      authEventCounter.inc({ action: 'otp_sent', provider: 'google', status: 'success' });

      // Drop the session established by passport until the OTP is verified.
      req.logout(() => {
        res.redirect(`${clientUrl}/login?step=otp&email=${encodeURIComponent(user.email)}`);
      });
    } catch (error) {
      logger.error(`Google OAuth error: ${error.message}`);
      authEventCounter.inc({ action: 'oauth', provider: 'google', status: 'failed' });
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      // passport.authenticate() may already have authenticated this session, so
      // always log out before redirecting to avoid leaving a partial login.
      const failRedirect = () => res.redirect(`${clientUrl}/login?error=otp_failed`);
      if (req.logout) {
        return req.logout(failRedirect);
      }
      return failRedirect();
    }
  }

  directOauthSuccess(req, res) {
    const user = req.user;
    const provider = user?.authProvider || 'social';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    authEventCounter.inc({ action: 'login', provider, status: 'success' });

    res.redirect(`${clientUrl}/dashboard`);
  }

  async verifyOtp(req, res, next) {
    try {
      const { email, otp } = req.body;

      if (!email) {
        return errorResponse(res, 400, 'Email is required for verification.');
      }

      const cleanOtp = typeof otp === 'string' ? otp.trim() : '';
      if (!/^\d{6}$/.test(cleanOtp)) {
        return errorResponse(res, 400, 'Please enter a valid 6-digit code.');
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });

      // Never reveal whether an email is registered.
      const genericFailure = () =>
        errorResponse(res, 401, 'Invalid or expired verification code. Please try again.');

      if (!user) {
        authEventCounter.inc({ action: 'verify_otp', provider: 'unknown', status: 'failed' });
        return genericFailure();
      }

      const expired = !user.otpExpiresAt || new Date() > new Date(user.otpExpiresAt);
      const locked = (user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS;
      const matches = verifyOtpHash(cleanOtp, user.otpCode);

      if (expired || locked || !matches) {
        const attempts = (user.otpAttempts || 0) + 1;
        if (attempts >= MAX_OTP_ATTEMPTS) {
          user.otpCode = null;
          user.otpExpiresAt = null;
          user.otpAttempts = 0;
        } else {
          user.otpAttempts = attempts;
        }
        await user.save();
        authEventCounter.inc({
          action: 'verify_otp',
          provider: user.authProvider,
          status: expired ? 'expired' : 'failed'
        });
        return genericFailure();
      }

      // Single-use: clear the code and the attempt counter.
      user.otpCode = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        authEventCounter.inc({ action: 'login', provider: user.authProvider, status: 'success' });

        logger.info('User authenticated with OTP: [REDACTED]');

        return successResponse(res, 200, 'Login successful', {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            authProvider: user.authProvider
          }
        });
      });
    } catch (error) {
      next(error);
    }
  }

  async resendOtp(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return errorResponse(res, 400, 'Email is required to resend code.');
      }

      const genericMessage = 'If that email is registered, a fresh 6-digit code has been sent.';
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      if (!user) {
        return successResponse(res, 200, genericMessage);
      }

      const otpCode = generateOtp();
      user.otpCode = hashOtp(otpCode);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      user.otpAttempts = 0;
      await user.save();

      await sendOtpEmail(user.email, otpCode, user.name);

      authEventCounter.inc({ action: 'resend_otp', provider: user.authProvider, status: 'success' });

      return successResponse(res, 200, genericMessage);
    } catch (error) {
      next(error);
    }
  }

  logout(req, res, next) {
    const provider = req.user?.authProvider || 'local';

    req.logout((err) => {
      if (err) return next(err);

      authEventCounter.inc({ action: 'logout', provider, status: 'success' });

      req.session.destroy((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        res.clearCookie('connect.sid');
        return successResponse(res, 200, 'Logged out successfully');
      });
    });
  }
}

export default new AuthController();
