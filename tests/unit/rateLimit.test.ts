import { describe, it, expect, beforeEach } from 'vitest';
import { takeToken } from '@/lib/rateLimit';

describe('rateLimit', () => {
  it('allows up to the limit within window', () => {
    const key = `k:${Math.random()}`;
    const limit = 3;
    const win = 1000; // 1s
    expect(takeToken(key, limit, win).ok).toBe(true);
    expect(takeToken(key, limit, win).ok).toBe(true);
    expect(takeToken(key, limit, win).ok).toBe(true);
    expect(takeToken(key, limit, win).ok).toBe(false);
  });
});

