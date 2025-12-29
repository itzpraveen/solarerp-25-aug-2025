const DEFAULT_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_USERNAME_DOMAIN ||
  process.env.AUTH_USERNAME_DOMAIN ||
  'erp.renewg.in';

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return USERNAME_RE.test(username);
}

export function usernameToEmail(username: string, domain = DEFAULT_DOMAIN) {
  return `${username}@${domain}`;
}

export function normalizeLoginIdentifier(input: string) {
  const raw = input.trim();
  if (!raw) {
    return { ok: false as const, error: 'Username is required.' };
  }
  const lower = raw.toLowerCase();
  if (lower.includes('@')) {
    return { ok: true as const, email: lower, username: lower.split('@')[0] };
  }
  const username = normalizeUsername(lower);
  if (!isValidUsername(username)) {
    return {
      ok: false as const,
      error: 'Username must be 3-32 chars (letters, numbers, . _ -).',
    };
  }
  return { ok: true as const, email: usernameToEmail(username), username };
}
