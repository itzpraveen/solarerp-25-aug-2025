export function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site;
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

