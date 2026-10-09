// Query parameters that carry credentials/PII and must never reach logs.
const SENSITIVE_PARAMS = new Set([
  'code',
  'state',
  'token',
  'access_token',
  'refresh_token',
  'otp',
  'password',
  'secret',
  'key',
  'session',
  'sig',
  'email'
]);

export const sanitizeUrl = (url) => {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return url;

  const path = url.slice(0, queryIndex);
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  for (const name of [...params.keys()]) {
    if (SENSITIVE_PARAMS.has(name.toLowerCase())) {
      params.set(name, '[REDACTED]');
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};
