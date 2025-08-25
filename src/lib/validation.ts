export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isPhone(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13; // allow country code
}

export function required(v: string | number | null | undefined) {
  return !(v === null || v === undefined || String(v).trim() === '');
}

