import { describe, it, expect } from 'vitest';
import { isPhone } from '@/lib/validation';

describe('isPhone', () => {
  it('accepts India numbers', () => {
    expect(isPhone('9876543210')).toBe(true); // 10-digit local
    expect(isPhone('919876543210')).toBe(true); // with country code, no +
    expect(isPhone('+919876543210')).toBe(true); // E.164
  });

  it('accepts GCC numbers without plus', () => {
    expect(isPhone('971566547786')).toBe(true); // UAE sample from screenshot
    expect(isPhone('966512345678')).toBe(true); // KSA 966 + 9
    expect(isPhone('97412345678')).toBe(true); // Qatar 974 + 8
    expect(isPhone('97312345678')).toBe(true); // Bahrain 973 + 8
    expect(isPhone('96812345678')).toBe(true); // Oman 968 + 8
    expect(isPhone('96512345678')).toBe(true); // Kuwait 965 + 8
  });

  it('accepts 00 international prefix', () => {
    expect(isPhone('00971566547786')).toBe(true); // 00 → +971
  });

  it('accepts generic E.164 with plus', () => {
    expect(isPhone('+12025550123')).toBe(true); // US example
  });

  it('rejects obviously invalid inputs', () => {
    expect(isPhone('12345')).toBe(false);
    expect(isPhone('abc')).toBe(false);
    expect(isPhone('0000000000')).toBe(false);
  });
});

