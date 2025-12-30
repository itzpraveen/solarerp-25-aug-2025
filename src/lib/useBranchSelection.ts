'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '@/lib/useProfile';

export type BranchValue = string | 'all';

export function useBranchSelection() {
  const { profile } = useProfile();
  const tenantId = profile?.tenant_id ?? null;
  const [branchId, setBranchIdState] = useState<BranchValue>('all');
  const branchRef = useRef<BranchValue>('all');
  const tenantRef = useRef<string | null>(null);

  useEffect(() => {
    branchRef.current = branchId;
  }, [branchId]);

  useEffect(() => {
    if (!tenantId || tenantRef.current === tenantId) return;
    tenantRef.current = tenantId;
    try {
      const saved = localStorage.getItem(`pref:branch:${tenantId}`) as
        | BranchValue
        | null;
      if (saved) setBranchIdState(saved);
    } catch {}
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    try {
      localStorage.setItem(`pref:branch:${tenantId}`, String(branchId));
    } catch {}
  }, [tenantId, branchId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<{ value?: BranchValue }>).detail?.value;
      if (next !== undefined && next !== branchRef.current) {
        setBranchIdState(next);
      }
    };
    window.addEventListener('branch-change', handler as any);
    return () => window.removeEventListener('branch-change', handler as any);
  }, []);

  const setBranchId = useCallback((next: BranchValue) => {
    setBranchIdState(next);
    try {
      window.dispatchEvent(
        new CustomEvent('branch-change', { detail: { value: next } }),
      );
    } catch {}
  }, []);

  return { branchId, setBranchId, tenantId };
}
