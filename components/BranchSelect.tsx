"use client";
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
}: {
  value: string | 'all';
  onChange: (val: string | 'all') => void;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      if (!prof?.tenant_id) return;
      const { data } = await supabase
        .from('branches')
        .select('id,name')
        .eq('tenant_id', (prof as any).tenant_id)
        .order('name', { ascending: true });
      setBranches(((data as any[]) || []).map((b) => ({ id: b.id, name: b.name })));
    })();
  }, []);

  return (
    <Select className={className} value={value} onChange={(e) => onChange(e.target.value as any)}>
      {includeAll && <option value="all">{allLabel}</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}

