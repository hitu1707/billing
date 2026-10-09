import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('API Integration Tests', () => {
  it('GET /api/health - should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('healthy'); // 👈 Updated to match response

    // Must not leak environment or system details
    expect(JSON.stringify(res.body)).not.toMatch(/production|development|test|env/i);
  });

  it('GET /api/non-existent-route - should return 404', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/register - should reject request missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Incomplete User'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('required');
  });

  it('POST /api/auth/register - should reject passwords shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pass User',
        email: 'shortpass@example.com',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('8 characters');
  });
});