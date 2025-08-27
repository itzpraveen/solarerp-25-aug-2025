'use client';
import { useEffect } from 'react';

export default function KeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Dot focuses command palette
      if (key === '.' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        window.dispatchEvent(new Event('open-cmdk'));
      }
      // g j → Jobs
      if (key === 'j' && (e as any)._prev === 'g') {
        window.location.href = '/jobs';
      } else if (key === 'l' && (e as any)._prev === 'g') {
        window.location.href = '/leads';
      }
      (e as any)._prev = key; // naive sequence tracker
      setTimeout(() => {
        (e as any)._prev = undefined;
      }, 500);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
