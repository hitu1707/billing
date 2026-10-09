import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/utils/password.js';

describe('Password Utility', () => {
  it('should hash a plain text password', async () => {
    const plainText = 'SecurePassword123!';
    const hash = await hashPassword(plainText);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainText);
    expect(hash.length).toBeGreaterThan(20);
  });

  it('should return true for a matching password', async () => {
    const plainText = 'MySecretPass';
    const hash = await hashPassword(plainText);

    const isMatch = await comparePassword(plainText, hash);
    expect(isMatch).toBe(true);
  });

  it('should return false for an incorrect password', async () => {
    const plainText = 'CorrectPassword';
    const wrongText = 'WrongPassword';
    const hash = await hashPassword(plainText);

    const isMatch = await comparePassword(wrongText, hash);
    expect(isMatch).toBe(false);
  });
});