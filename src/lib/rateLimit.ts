// Rate limiting helpers with optional Upstash Redis backend.
// - In dev/single instance: falls back to in-memory bucket limiter
// - In production with Upstash vars set: uses atomic INCR + EXPIRE
import 'server-only';
import { env } from '@/lib/env';

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export async function takeTokenAsync(
  key: string,
  limit: number,
  windowMs: number,
) {
  // Prefer Upstash when configured
  if (env.upstashUrl && env.upstashToken) {
    try {
      // INCR key; if result === 1 set EXPIRE
      const url = env.upstashUrl.replace(/\/$/, '');
      const headers = { Authorization: `Bearer ${env.upstashToken}` } as any;
      const incr = await fetch(`${url}/INCR/${encodeURIComponent(key)}`, {
        headers,
        cache: 'no-store',
      }).then((r) => r.json() as Promise<{ result: number }>);
      if (incr?.result === 1) {
        // Set TTL only on first increment in window
        await fetch(
          `${url}/PEXPIRE/${encodeURIComponent(key)}/${Math.max(1, Math.floor(windowMs))}`,
          { headers, cache: 'no-store' },
        );
      }
      const remaining = Math.max(0, limit - (incr?.result || 0));
      // We don't know exact resetAt from Upstash in REST; approximate with now+windowMs
      return { ok: remaining > 0, remaining: Math.max(0, remaining - 1), resetAt: Date.now() + windowMs };
    } catch {
      // Fallback to memory on any network error
    }
  }

  // In-memory fallback
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

// Convenience wrapper to rate-limit a request by client IP with a route prefix.
// Returns { ok, remaining, resetAt } similar to takeToken() and the derived ip.
export function limitByIp(
  headers: Headers,
  prefix: string,
  limit: number,
  windowMs: number,
) {
  const ip = ipFromHeaders(headers);
  const key = `${prefix}:${ip}`;
  const res = takeToken(key, limit, windowMs);
  return { ...res, ip };
}

export async function limitByIpAsync(
  headers: Headers,
  prefix: string,
  limit: number,
  windowMs: number,
) {
  const ip = ipFromHeaders(headers);
  const key = `${prefix}:${ip}`;
  const res = await takeTokenAsync(key, limit, windowMs);
  return { ...res, ip };
}

// Back-compat small wrapper for existing codepaths that called takeToken synchronously.
export function takeToken(key: string, limit: number, windowMs: number) {
  // Synchronous wrapper: uses in-memory only, reserved for light paths.
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
