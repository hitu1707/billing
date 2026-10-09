import request from 'supertest';
import app from '../../src/app.js';

export const lastOtpFor = (email) => {
  const list = globalThis.__TEST_OTPS__ || [];
  const normalized = String(email).toLowerCase();
  const entry = [...list].reverse().find((item) => item.email === normalized);
  return entry?.otp;
};

// Registers a user, reads the captured OTP, verifies it, and returns the
// authenticated session cookie.
export const registerAndLogin = async (user) => {
  await request(app).post('/api/auth/register').send(user);
  const otp = lastOtpFor(user.email);
  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: user.email, otp });
  return res.headers['set-cookie'];
};
