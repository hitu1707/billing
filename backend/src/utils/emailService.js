import 'dotenv/config';
import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

// Escape user-controlled values before interpolating them into email HTML.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

export const sendOtpEmail = async (toEmail, otpCode, userName) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass || emailUser.includes('your_email')) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('EMAIL_USER or EMAIL_PASS not configured; OTP email cannot be sent.');
      return false;
    }
    logger.warn('⚠️ EMAIL_USER or EMAIL_PASS not configured in backend/.env.');
    logger.info(`=========================================`);
    logger.info(`📧 DEV OTP (recipient: [REDACTED]): [ ${otpCode} ]`);
    logger.info(`=========================================`);
    return true;
  }

  const cleanPass = emailPass.replace(/\s+/g, '');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser.trim(),
      pass: cleanPass
    }
  });

  const mailOptions = {
    from: `"BillTracker Security" <${emailUser.trim()}>`,
    to: toEmail.trim(),
    subject: `🔐 Your Login Verification Code: ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; text-align: center; margin-bottom: 8px;">🧾 BillTracker</h2>
        <p style="font-size: 15px; color: #374151;">Hello <strong>${escapeHtml(userName || 'User')}</strong>,</p>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          Use the 6-digit verification code below to complete your login. This code is valid for <strong>10 minutes</strong>.
        </p>
        
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #111827; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; display: inline-block; border: 1px solid #e5e7eb;">
            ${otpCode}
          </span>
        </div>

        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.4;">
          If you did not request this code, please ignore this email or secure your account.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('✅ Real email successfully sent to: [REDACTED]');
    return true;
  } catch (error) {
    logger.error(`❌ Gmail Sending Failed: ${error.message}`);
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`📧 FALLBACK OTP (recipient: [REDACTED]): [ ${otpCode} ]`);
    }
    return false;
  }
};
