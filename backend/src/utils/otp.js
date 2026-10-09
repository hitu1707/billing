import crypto from 'crypto';

const secret = () =>
  process.env.OTP_SECRET || process.env.SESSION_SECRET || 'insecure-dev-otp-secret';

export const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Only a keyed hash of the OTP is stored, so a database leak cannot be replayed.
export const hashOtp = (otp) =>
  crypto.createHmac('sha256', secret()).update(String(otp)).digest('hex');

export const verifyOtpHash = (otp, storedHash) => {
  if (!otp || !storedHash) return false;
  const candidate = Buffer.from(hashOtp(otp));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};
