import 'server-only';
import crypto from 'node:crypto';

// Constant-time equality check for secrets (hides length and content timing).
// Uses HMAC with a per-process random key so digests are fixed-length.
const key = crypto.randomBytes(32);

export function secureEqual(a: string, b: string): boolean {
  try {
    const da = crypto.createHmac('sha256', key).update(String(a || '')).digest();
    const db = crypto.createHmac('sha256', key).update(String(b || '')).digest();
    return crypto.timingSafeEqual(da, db);
  } catch {
    return false;
  }
}

