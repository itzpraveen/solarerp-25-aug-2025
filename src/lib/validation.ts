export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isPhone(v: string) {
  // Normalize: allow digits and optional leading +
  const s = v.replace(/[^\d+]/g, '').trim();
  // E.164 style: +<country><number>, total 10-15 digits, country can't start with 0
  if (/^\+[1-9]\d{9,14}$/.test(s)) return true;
  // India-specific allowances: 10-digit starting 6-9, or 91 + 10 digits
  if (/^(91)?[6-9]\d{9}$/.test(s)) return true;
  return false;
}

export function required(v: string | number | null | undefined) {
  return !(v === null || v === undefined || String(v).trim() === '');
}
