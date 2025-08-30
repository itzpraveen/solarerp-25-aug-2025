import { describe, it, expect } from 'vitest';
import { secureEqual } from '@/lib/secureCompare';

describe('secureCompare.secureEqual', () => {
  it('returns true for equal strings', () => {
    expect(secureEqual('abc', 'abc')).toBe(true);
    expect(secureEqual('', '')).toBe(true);
  });

  it('returns false for different strings; coerces types', () => {
    expect(secureEqual('abc', 'abcd')).toBe(false);
    expect(secureEqual('abc', '')).toBe(false);
    // coerces inputs to string internally
    expect(secureEqual('123', 123 as any)).toBe(true);
  });
});
