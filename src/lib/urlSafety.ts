export function isSafeBrowserUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isStorageObjectKey(raw: string) {
  return !!raw && !/^[a-z]+:/i.test(raw) && /^[^?#\s]+\/[^?#\s]+$/.test(raw);
}
