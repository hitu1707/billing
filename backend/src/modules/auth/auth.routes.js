import express from 'express';
import passport from '../../config/passport.js';
import authController from './auth.controller.js';
import {
  loginLimiter,
  registerLimiter,
  verifyOtpLimiter,
  resendOtpLimiter
} from '../../middleware/rateLimiter.js';

const router = express.Router();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/verify-otp', verifyOtpLimiter, authController.verifyOtp);
router.post('/resend-otp', resendOtpLimiter, authController.resendOtp);

// Google requires email OTP after OAuth; Facebook and Discord log in directly.
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${clientUrl}/login?error=google_failed` }),
  authController.googleOauthSuccess
);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: `${clientUrl}/login?error=facebook_failed` }),
  authController.directOauthSuccess
);

router.get('/discord', passport.authenticate('discord'));
router.get(
  '/discord/callback',
  passport.authenticate('discord', { failureRedirect: `${clientUrl}/login?error=discord_failed` }),
  authController.directOauthSuccess
);

router.post('/logout', authController.logout);

export default router;
