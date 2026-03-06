import 'server-only';

export function isServerMockMode() {
  return process.env.E2E_MOCK === '1' || process.env.NODE_ENV === 'test';
}
