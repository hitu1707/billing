import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers/auth.js';
import { jpegBuffer, notAnImageBuffer } from '../fixtures/images.js';

vi.mock('../../src/utils/aiExtractor.js', () => ({
  extractBillData: vi.fn().mockResolvedValue({
    productName: 'Secured Product',
    price: 100,
    totalPrice: 118,
    category: 'Electronics'
  })
}));

describe('Bill Security: mass-assignment, ownership, uploads & signed images', () => {
  let user1Cookie;
  let user2Cookie;
  let user2Id;

  const createBill = (cookie) =>
    request(app).post('/api/bills/scan').set('Cookie', cookie).attach('billImage', jpegBuffer, 'bill.jpg');

  beforeAll(() => {
    // Force the local storage fallback so the signed-image path is exercised
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  beforeEach(async () => {
    user1Cookie = await registerAndLogin({
      name: 'Owner One',
      email: 'owner1@example.com',
      password: 'Password123!'
    });

    user2Cookie = await registerAndLogin({
      name: 'Owner Two',
      email: 'owner2@example.com',
      password: 'Password123!'
    });

    const profile = await request(app).get('/api/users/profile').set('Cookie', user2Cookie);
    user2Id = profile.body.data.id;
  });

  it('ignores attempts to reassign bill ownership (userId is not writable)', async () => {
    const createRes = await createBill(user1Cookie);
    const billId = createRes.body.data._id;

    // Only an ownership field -> rejected as "no valid fields"
    const massAssign = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Cookie', user1Cookie)
      .send({ userId: user2Id });
    expect(massAssign.status).toBe(400);

    // Ownership field mixed with a valid field -> valid field applied, userId ignored
    const mixed = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Cookie', user1Cookie)
      .send({ productName: 'Renamed', userId: user2Id });
    expect(mixed.status).toBe(200);

    // User 1 still owns it
    const asUser1 = await request(app).get(`/api/bills/${billId}`).set('Cookie', user1Cookie);
    expect(asUser1.status).toBe(200);

    // User 2 still cannot see it
    const listUser2 = await request(app).get('/api/bills').set('Cookie', user2Cookie);
    expect(listUser2.body.data.length).toBe(0);
  });

  it('does not let a client overwrite storage internals (cloudinaryPublicId)', async () => {
    const createRes = await createBill(user1Cookie);
    const billId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Cookie', user1Cookie)
      .send({ cloudinaryPublicId: 'victim_public_id' });

    expect(res.status).toBe(400);
  });

  it('rejects a file whose content is not a real image (magic-byte check)', async () => {
    const res = await request(app)
      .post('/api/bills/scan')
      .set('Cookie', user1Cookie)
      .attach('billImage', notAnImageBuffer, 'evil.jpg');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid file type');
  });

  it('serves local receipts only via a valid signed URL and no longer via /uploads', async () => {
    const createRes = await createBill(user1Cookie);
    expect(createRes.status).toBe(201);

    const imageUrl = createRes.body.data.billImageUrl;
    expect(imageUrl).toContain('/api/bills/image/');

    const parsed = new URL(imageUrl);
    const signedPath = `${parsed.pathname}${parsed.search}`;

    // Valid signature, no session cookie -> served
    const ok = await request(app).get(signedPath);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('image/jpeg');

    // Missing signature -> forbidden
    const noSig = await request(app).get(parsed.pathname);
    expect(noSig.status).toBe(403);

    // Tampered signature -> forbidden
    const tampered = await request(app).get(
      `${parsed.pathname}?e=${parsed.searchParams.get('e')}&s=deadbeef`
    );
    expect(tampered.status).toBe(403);

    // Path traversal attempt -> forbidden
    const traversal = await request(app).get(
      `/api/bills/image/${encodeURIComponent('../.env')}?e=9999999999999&s=x`
    );
    expect(traversal.status).toBe(403);

    // The old public static path must be gone
    const fileName = parsed.pathname.split('/').pop();
    const legacy = await request(app).get(`/uploads/${fileName}`);
    expect(legacy.status).toBe(404);
  });
});
