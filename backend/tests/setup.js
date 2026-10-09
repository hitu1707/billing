import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Must be set before test files import app.js, or the session store
// would connect to the real database.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_secret_12345';
process.env.PORT = '3001';

const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

vi.mock('../src/config/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    http: vi.fn()
  }
}));

vi.mock('../src/config/cloudinary.js', () => ({
  default: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn().mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test/image/upload/sample.jpg',
        public_id: 'test_public_id'
      }),
      destroy: vi.fn().mockResolvedValue({ result: 'ok' })
    }
  }
}));

// Capture OTP codes instead of sending email, so tests can complete the flow.
vi.mock('../src/utils/emailService.js', () => ({
  sendOtpEmail: vi.fn(async (email, otp) => {
    globalThis.__TEST_OTPS__ = globalThis.__TEST_OTPS__ || [];
    globalThis.__TEST_OTPS__.push({ email, otp });
    return true;
  })
}));
