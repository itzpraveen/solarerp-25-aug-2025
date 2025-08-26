// Very small in-memory rate limiter. Suitable for single-instance or best-effort limits.
// For production multi-instance, use Redis/Upstash or provider-native rate limits.

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export function takeToken(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
    return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  if (b.count < limit) {
    b.count += 1;
    return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
  }
  return { ok: false, remaining: 0, resetAt: b.resetAt };
}

export function ipFromHeaders(headers: Headers) {
  const fwd = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '';
  // First IP in the list
  return fwd.split(',')[0].trim() || 'unknown';
}

