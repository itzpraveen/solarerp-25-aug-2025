export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isPhone(v: string) {
  // Normalize: keep digits and an optional leading +; convert 00 prefix to +
  let s = v.replace(/[^\d+]/g, '').trim();
  if (s.startsWith('00')) s = '+' + s.slice(2);

  // E.164 with +: +<country><number>, 10–15 total digits
  if (/^\+[1-9]\d{9,14}$/.test(s)) return true;

  // For inputs without +, allow common country-code-prefixed formats
  const digits = s.replace(/\D+/g, '');

  // India: 10‑digit starting 6–9, or prefixed with 91
  if (/^(91)?[6-9]\d{9}$/.test(digits)) return true;

  // GCC countries without + (country code + local number)
  // UAE 971 + 9, KSA 966 + 9, Qatar 974 + 8, Bahrain 973 + 8, Oman 968 + 8, Kuwait 965 + 8
  const gccPatterns: [string, number, number][] = [
    ['971', 9, 9], // UAE
    ['966', 9, 9], // Saudi Arabia
    ['974', 8, 8], // Qatar
    ['973', 8, 8], // Bahrain
    ['968', 8, 8], // Oman
    ['965', 8, 8], // Kuwait
  ];
  for (const [cc, min, max] of gccPatterns) {
    if (digits.startsWith(cc)) {
      const len = digits.length - cc.length;
      if (len >= min && len <= max) return true;
    }
  }

  return false;
}

export function required(v: string | number | null | undefined) {
  return !(v === null || v === undefined || String(v).trim() === '');
}
