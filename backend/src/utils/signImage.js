import crypto from 'crypto';

const secret = () =>
  process.env.IMAGE_SIGNING_SECRET || process.env.SESSION_SECRET || 'insecure-dev-image-secret';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Produces a stateless, unguessable URL for a locally stored bill image, so the
// file cannot be enumerated by an unauthenticated user.
export const signImageFile = (fileName, ttlMs = ONE_YEAR_MS) => {
  const exp = Date.now() + ttlMs;
  const sig = crypto
    .createHmac('sha256', secret())
    .update(`${fileName}.${exp}`)
    .digest('base64url');
  return { exp, sig };
};

export const verifyImageSignature = (fileName, exp, sig) => {
  const expNum = Number(exp);
  if (!sig || !Number.isFinite(expNum) || expNum < Date.now()) return false;

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${fileName}.${expNum}`)
    .digest('base64url');

  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
