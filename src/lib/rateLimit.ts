// Distributed rate limiter with Upstash Redis REST; falls back to in-memory for single-instance dev/test.
// takeToken is async to accommodate network calls. Callers in API routes should await it.

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function getUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export async function takeToken(key: string, limit: number, windowMs: number) {
  const upstash = getUpstash();
  const namespaced = `ratelimit:${key}`;
  const now = Date.now();

  if (!upstash) {
    // Fallback: in-memory fixed window
    const b = store.get(namespaced);
    if (!b || b.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + windowMs };
      store.set(namespaced, bucket);
      return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
    }
    if (b.count < limit) {
      b.count += 1;
      return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
    }
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }

  try {
    // Use Upstash pipeline: INCR, PEXPIRE NX, PTTL
    const res = await fetch(`${upstash.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commands: [
          ['INCR', namespaced],
          ['PEXPIRE', namespaced, String(windowMs), 'NX'],
          ['PTTL', namespaced],
        ],
      }),
    });
    const data = (await res.json()) as Array<{ result: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const pttl = Number(data?.[2]?.result ?? windowMs);
    const resetAt = now + (pttl > 0 ? pttl : windowMs);
    if (count <= limit) {
      return { ok: true, remaining: Math.max(0, limit - count), resetAt };
    }
    return { ok: false, remaining: 0, resetAt };
  } catch {
    // Network error: fail open with conservative in-memory bucket
    const b = store.get(namespaced);
    if (!b || b.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + windowMs };
      store.set(namespaced, bucket);
      return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
    }
    if (b.count < limit) {
      b.count += 1;
      return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
    }
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
}

export function ipFromHeaders(headers: Headers) {
  const fwd = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}
