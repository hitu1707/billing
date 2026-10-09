import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Capture the OTP that the service would have emailed (email is stubbed out)
const { sentOtps } = vi.hoisted(() => ({ sentOtps: new Map() }));
vi.mock('../../src/utils/emailService.js', () => ({
  sendOtpEmail: vi.fn(async (email, otp) => {
    sentOtps.set(email.toLowerCase(), otp);
    return true;
  })
}));

import app from '../../src/app.js';
import User from '../../src/models/User.js';

describe('OTP flow: hashing, single-use, lockout & enumeration resistance', () => {
  const email = 'otp.user@example.com';
  const password = 'Password123!';

  beforeEach(() => {
    sentOtps.clear();
  });

  const startLogin = async () => {
    await request(app).post('/api/auth/register').send({ name: 'OTP User', email, password });
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res;
  };

  it('stores only a hash of the OTP, not the plaintext code', async () => {
    const loginRes = await startLogin();
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.requiresOtp).toBe(true);

    const otp = sentOtps.get(email);
    expect(otp).toMatch(/^\d{6}$/);

    const stored = await User.findOne({ email });
    expect(stored.otpCode).not.toBe(otp);
    expect(stored.otpCode).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
  });

  it('accepts a correct code, establishes a session, and burns the code (single-use)', async () => {
    await startLogin();
    const otp = sentOtps.get(email);

    const verify = await request(app).post('/api/auth/verify-otp').send({ email, otp });
    expect(verify.status).toBe(200);

    const cookie = verify.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const profile = await request(app).get('/api/users/profile').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);

    // Replaying the same code must fail
    const replay = await request(app).post('/api/auth/verify-otp').send({ email, otp });
    expect(replay.status).toBe(401);
  });

  it('locks the OTP after 5 failed attempts', async () => {
    await startLogin();
    const otp = sentOtps.get(email);

    for (let i = 0; i < 5; i += 1) {
      const bad = await request(app).post('/api/auth/verify-otp').send({ email, otp: '000000' });
      expect(bad.status).toBe(401);
    }

    // Correct code is now invalid because the code was burned
    const afterLock = await request(app).post('/api/auth/verify-otp').send({ email, otp });
    expect(afterLock.status).toBe(401);
  });

  it('rejects malformed codes without touching the account', async () => {
    await startLogin();
    const res = await request(app).post('/api/auth/verify-otp').send({ email, otp: 'abc' });
    expect(res.status).toBe(400);
  });

  it('does not reveal whether an email is registered', async () => {
    const verifyUnknown = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'nobody@example.com', otp: '123456' });
    expect(verifyUnknown.status).toBe(401);
    expect(verifyUnknown.body.message).not.toContain('not found');

    const resendUnknown = await request(app)
      .post('/api/auth/resend-otp')
      .send({ email: 'nobody@example.com' });
    expect(resendUnknown.status).toBe(200);
    expect(resendUnknown.body.message).toContain('If that email is registered');

    // No OTP should be generated for a non-existent account
    expect(sentOtps.has('nobody@example.com')).toBe(false);
  });
});
