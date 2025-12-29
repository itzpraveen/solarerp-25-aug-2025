'use client';
import React, { useEffect, useRef, useState } from 'react';
import Select from '~/components/ui/Select';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useProfile } from '@/lib/useProfile';

type Branch = { id: string; name: string };

type BranchCacheEntry = { rows: Branch[]; at: number };
const branchCache = new Map<string, BranchCacheEntry>();
const branchInflight = new Map<string, Promise<Branch[]>>();
const BRANCH_TTL_MS = 5 * 60 * 1000;

async function loadBranches(
  supabase: ReturnType<typeof supabaseBrowser>,
  tenantId: string,
) {
  const cached = branchCache.get(tenantId);
  if (cached && Date.now() - cached.at < BRANCH_TTL_MS) return cached.rows;
  const inflight = branchInflight.get(tenantId);
  if (inflight) return inflight;
  const run = (async () => {
    const { data } = await supabase
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    const rows = ((data as any[]) || []).map((b) => ({
      id: b.id,
      name: b.name,
    }));
    branchCache.set(tenantId, { rows, at: Date.now() });
    return rows;
  })();
  branchInflight.set(tenantId, run);
  try {
    return await run;
  } finally {
    branchInflight.delete(tenantId);
  }
}

export default function BranchSelect({
  value,
  onChange,
  includeAll = true,
  allLabel = 'All branches',
  className,
  persist = true,
}: {
  value: string | 'all';
  onChange: (val: string | 'all') => void;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  persist?: boolean;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const supabase = supabaseBrowser();
  const { profile } = useProfile();
  const tenantId = profile?.tenant_id || null;
  const appliedForTenant = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!tenantId) return;
    (async () => {
      const rows = await loadBranches(supabase, tenantId);
      if (!alive) return;
      setBranches(rows);
      // Apply persisted selection once per tenant
      if (persist && appliedForTenant.current !== tenantId) {
        appliedForTenant.current = tenantId;
        try {
          const key = `pref:branch:${tenantId}`;
          const saved = localStorage.getItem(key) as string | null;
          if (
            saved &&
            (saved === 'all' ? includeAll : rows.some((r) => r.id === saved))
          ) {
            onChange(saved as any);
          }
        } catch {}
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenantId, persist, includeAll, onChange, supabase]);

  // Persist whenever value changes
  useEffect(() => {
    if (!persist || !tenantId) return;
    try {
      localStorage.setItem(`pref:branch:${tenantId}`, String(value));
    } catch {}
  }, [value, persist, tenantId]);

  return (
    <Select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
    >
      {includeAll && <option value="all">{allLabel}</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}
