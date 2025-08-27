'use client';
import React, { useEffect, useState } from 'react';
import Select from '~/components/ui/Select';
import { supabaseBrowser } from '@/lib/supabaseClient';

type Branch = { id: string; name: string };

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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      const tId = (prof as any)?.tenant_id as string | undefined;
      if (!tId) return;
      setTenantId(tId);
      const { data } = await supabase
        .from('branches')
        .select('id,name')
        .eq('tenant_id', tId)
        .order('name', { ascending: true });
      const rows = ((data as any[]) || []).map((b) => ({
        id: b.id,
        name: b.name,
      }));
      setBranches(rows);
      // Apply persisted selection on first load
      if (persist) {
        try {
          const key = `pref:branch:${tId}`;
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
  }, [persist, includeAll]);

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
