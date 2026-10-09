import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers/auth.js';

describe('User Profile Filtering & Account Deletion', () => {
  const testUser = {
    name: 'Privacy Tester',
    email: 'privacy@example.com',
    password: 'Password123!',
    phone: '5551234567'
  };

  it('GET /api/users/profile - returns only whitelisted fields', async () => {
    const cookie = await registerAndLogin(testUser);

    const res = await request(app).get('/api/users/profile').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const profile = res.body.data;
    expect(profile.name).toBe(testUser.name);
    expect(profile.email).toBe(testUser.email);
    expect(profile.phone).toBe(testUser.phone);

    // Sensitive / internal fields must never be returned
    expect(profile).not.toHaveProperty('password');
    expect(profile).not.toHaveProperty('otpCode');
    expect(profile).not.toHaveProperty('otpExpiresAt');
    expect(profile).not.toHaveProperty('googleId');
    expect(profile).not.toHaveProperty('facebookId');
    expect(profile).not.toHaveProperty('discordId');
    expect(profile).not.toHaveProperty('_id');
    expect(profile).not.toHaveProperty('totalBillsScanned');
  });

  it('PUT /api/users/profile - rejects updates with no whitelisted fields', async () => {
    const cookie = await registerAndLogin(testUser);

    const res = await request(app)
      .put('/api/users/profile')
      .set('Cookie', cookie)
      .send({ password: 'hacked', totalBillsScanned: 9999, email: 'new@example.com' });

    expect(res.status).toBe(400);
  });

  it('DELETE /api/users/account - requires authentication', async () => {
    const res = await request(app).delete('/api/users/account');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/users/account - purges user data and invalidates session', async () => {
    const cookie = await registerAndLogin(testUser);

    const del = await request(app).delete('/api/users/account').set('Cookie', cookie);
    expect(del.status).toBe(200);
    expect(del.body.message).toContain('deleted');

    // Session must be destroyed
    const profile = await request(app).get('/api/users/profile').set('Cookie', cookie);
    expect(profile.status).toBe(401);

    // User record must be gone: the same email can register again
    const reReg = await request(app).post('/api/auth/register').send(testUser);
    expect(reReg.status).toBe(201);
  });
});
