import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers/auth.js';
import { jpegBuffer } from '../fixtures/images.js';

// Dynamic mock that is always 2 years in the future
vi.mock('../../src/utils/aiExtractor.js', () => ({
  extractBillData: vi.fn().mockImplementation(async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    return {
      productName: 'Samsung 55-inch OLED TV',
      vendorName: 'BestBuy',
      price: 1200,
      totalPrice: 1296,
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyPeriod: '2 years',
      warrantyEndDate: futureDate.toISOString().split('T')[0],
      category: 'Electronics'
    };
  })
}));

describe('Bill Management Endpoints (CRUD & Isolation)', () => {
  let user1Cookie;
  let user2Cookie;

  beforeEach(async () => {
    user1Cookie = await registerAndLogin({
      name: 'User One',
      email: 'user1@example.com',
      password: 'Password123!'
    });

    user2Cookie = await registerAndLogin({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'Password123!'
    });
  });

  it('GET /api/bills - should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/bills');
    expect(res.status).toBe(401);
  });

  it('POST /api/bills/scan - should scan, save bill, and link to logged-in user', async () => {
    const res = await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', jpegBuffer, 'test-receipt.jpg');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productName).toBe('Samsung 55-inch OLED TV');
    expect(res.body.data.warrantyStatus).toBe('Active');
  });

  it('GET /api/bills - should ONLY return bills belonging to logged-in user (Data Privacy)', async () => {
    await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', jpegBuffer, 'bill1.jpg');

    const resUser1 = await request(app).get('/api/bills').set('Cookie', user1Cookie);
    expect(resUser1.status).toBe(200);
    expect(resUser1.body.data.length).toBe(1);

    const resUser2 = await request(app).get('/api/bills').set('Cookie', user2Cookie);
    expect(resUser2.status).toBe(200);
    expect(resUser2.body.data.length).toBe(0);
  });

  it('PUT /api/bills/:id - should update bill details', async () => {
    const createRes = await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', jpegBuffer, 'bill.jpg');

    const billId = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Cookie', user1Cookie)
      .send({ productName: 'Updated Samsung TV 65-inch' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.productName).toBe('Updated Samsung TV 65-inch');
  });

  it('DELETE /api/bills/:id - should delete bill for owner', async () => {
    const createRes = await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', jpegBuffer, 'bill.jpg');

    const billId = createRes.body.data._id;

    const delRes = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Cookie', user1Cookie);

    expect(delRes.status).toBe(200);
    expect(delRes.body.message).toContain('deleted');
  });

  it('DELETE /api/bills/:id - should prevent User 2 from deleting User 1 bill', async () => {
    const createRes = await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', jpegBuffer, 'bill.jpg');

    const billId = createRes.body.data._id;

    const delRes = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Cookie', user2Cookie);

    expect(delRes.status).toBe(404);
  });
});