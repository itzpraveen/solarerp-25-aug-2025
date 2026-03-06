import 'server-only';
import dns from 'node:dns/promises';
import net from 'node:net';
import { isSafeBrowserUrl } from '@/lib/urlSafety';

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  );
}

function isPrivateAddress(address: string) {
  const kind = net.isIP(address);
  if (kind === 4) return isPrivateIpv4(address);
  if (kind === 6) return isPrivateIpv6(address);
  return true;
}

export async function isSafePublicHttpUrl(raw: string) {
  try {
    if (!isSafeBrowserUrl(raw)) return false;

    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) {
      return false;
    }

    const hostType = net.isIP(host);
    if (hostType === 4 || hostType === 6) {
      return !isPrivateAddress(host);
    }

    const lookups = await dns.lookup(host, { all: true, verbatim: true });
    if (!lookups.length) return false;

    return lookups.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}
