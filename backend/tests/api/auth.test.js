import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, lastOtpFor } from '../helpers/auth.js';

describe('Auth Endpoints & Session Management', () => {
  const testUser = {
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    password: 'Password123!',
    phone: '9876543210'
  };

  it('POST /api/auth/register - should create account and require email OTP (no session)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresOtp).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user).toBeUndefined();

    // Registration must NOT start a session
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('POST /api/auth/register - should not reveal that an email already exists', async () => {
    const first = await request(app).post('/api/auth/register').send(testUser);
    const second = await request(app).post('/api/auth/register').send(testUser);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.requiresOtp).toBe(true);
    expect(second.body.message).toBe(first.body.message);
  });

  it('POST /api/auth/login - should authenticate valid user and require OTP', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresOtp).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user).toBeUndefined();
  });

  it('POST /api/auth/login - should reject wrong password', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/verify-otp - should establish a session for a valid code', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const otp = lastOtpFor(testUser.email);

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testUser.email, otp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie'][0]).toContain('connect.sid');
  });

  it('POST /api/auth/verify-otp - should reject an invalid code', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testUser.email, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/logout - should clear session cookie', async () => {
    const cookie = await registerAndLogin(testUser);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
