'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useProfile } from '@/lib/useProfile';

type Result =
  | { type: 'job'; id: string; title: string; subtitle?: string }
  | { type: 'customer'; id: string; title: string; subtitle?: string }
  | { type: 'action'; id: string; title: string; subtitle?: string }
  | { type: 'nav'; id: string; title: string; subtitle?: string };

export default function CommandPalette() {
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState(0);
  const [branchId, setBranchId] = useState<string | 'all'>('all');
  const { profile } = useProfile();

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setDebouncedQ('');
    setResults([]);
    setSel(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const rawKey = e.key || '';
      const key = rawKey.toLowerCase();
      const isCmdK = (e.ctrlKey || e.metaKey) && key === 'k';
      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
      }
      if (open && (rawKey === 'Escape' || key === 'escape')) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener('open-cmdk', onOpen as any);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-cmdk', onOpen as any);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  // Initialize context (tenant + branch) when palette opens
  useEffect(() => {
    if (!open) return;
    const tId = profile?.tenant_id;
    if (!tId) return;
    try {
      const saved = localStorage.getItem(`pref:branch:${tId}`) as
        | string
        | null;
      if (saved) setBranchId(saved as any);
    } catch {}
  }, [open, profile?.tenant_id]);

  // Debounce search input to reduce Supabase queries
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  // Fetch results from Supabase when q changes
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!open) return;
      const term = debouncedQ.trim();
      if (term.length < 2) {
        setLoading(false);
        setResults([
          {
            type: 'nav',
            id: '/overview',
            title: 'Overview',
            subtitle: 'Dashboard',
          },
          { type: 'nav', id: '/jobs', title: 'Jobs', subtitle: 'Pipeline' },
          { type: 'nav', id: '/leads', title: 'Leads', subtitle: 'Follow-ups' },
          {
            type: 'nav',
            id: '/proposals/new',
            title: 'New Proposal',
            subtitle: 'Generate PDF',
          },
          {
            type: 'nav',
            id: '/customers',
            title: 'Customers',
            subtitle: 'Directory',
          },
        ]);
        return;
      }
      setLoading(true);
      try {
        // 1) Find matching customers
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, phone, email')
          .or(
            `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
          )
          .limit(5);

        const custIds = (customers || []).map((c: any) => c.id);
        // 2) Find jobs by those customers and also by id fragment; respect selected branch if present
        let jobsByCustomer: any = { data: [] };
        if (custIds.length) {
          let j = supabase
            .from('jobs')
            .select('id, capacity_kw, system_type, customer_id, branch_id')
            .in('customer_id', custIds as string[])
            .limit(10) as any;
          if (branchId && branchId !== 'all') j = j.eq('branch_id', branchId);
          jobsByCustomer = await j;
        }
        let jobsById = supabase
          .from('jobs')
          .select('id, capacity_kw, system_type, customer_id, branch_id')
          .ilike('id', `%${term}%`)
          .limit(5) as any;
        if (branchId && branchId !== 'all')
          jobsById = jobsById.eq('branch_id', branchId);
        jobsById = await jobsById;

        // Map to presentable results
        const nameById = new Map<string, string>();
        for (const c of (customers as any[]) || [])
          nameById.set(c.id, c.name || '—');
        const jobRows = Array.from(
          new Map(
            [
              ...(((jobsByCustomer as any)?.data as any[]) || []),
              ...((jobsById.data as any[]) || []),
            ].map((j: any) => [j.id, j]),
          ).values(),
        ).slice(0, 10);

        const jobResults: Result[] = jobRows.map((j: any) => ({
          type: 'job',
          id: j.id,
          title: nameById.get(j.customer_id) || 'Job',
          subtitle: `${j.system_type || '—'} • ${j.capacity_kw ?? '—'} kW • ${j.id}`,
        }));

        const customerResults: Result[] = ((customers as any[]) || []).map(
          (c: any) => ({
            type: 'customer',
            id: c.id,
            title: c.name || '—',
            subtitle: [c.phone, c.email].filter(Boolean).join(' • '),
          }),
        );

        if (!active) return;
        // Quick actions
        const actions: Result[] = [];
        const t = term.toLowerCase();
        const showActions =
          term.length < 2 ||
          t.startsWith('new') ||
          t.startsWith('add') ||
          t === '+';
        if (showActions) {
          actions.push(
            {
              type: 'action',
              id: 'new:lead',
              title: 'New Lead',
              subtitle: 'Create a lead',
            },
            {
              type: 'action',
              id: 'new:customer',
              title: 'New Customer',
              subtitle: 'Add a customer',
            },
            {
              type: 'action',
              id: 'new:job',
              title: 'New Job',
              subtitle: 'Open Jobs to create',
            },
          );
        }
        setResults(
          [...actions, ...jobResults, ...customerResults].slice(0, 15),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [debouncedQ, supabase, branchId, open]);

  const onOpenRoute = useCallback(
    (r: Result) => {
      if (r.type === 'job') window.location.href = `/jobs/${r.id}`;
      else if (r.type === 'customer')
        window.location.href = `/customers/${r.id}`;
      else if (r.type === 'action') {
        if (r.id === 'new:lead') window.location.href = '/leads';
        if (r.id === 'new:customer') window.location.href = '/customers';
        if (r.id === 'new:job') window.location.href = '/jobs';
      } else if (r.type === 'nav') window.location.href = r.id;
      close();
    },
    [close],
  );

  const visible = open;
  const nothing = !loading && q.trim().length >= 2 && results.length === 0;

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/70"
        onClick={close}
      />
      <div className="relative mt-24 w-full max-w-2xl rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center border-b border-[var(--border-subtle)] px-3 py-2">
          <input
            ref={inputRef}
            className="w-full bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Search jobs and customers… (Ctrl/Cmd+K)"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter') {
                const r = results[sel];
                if (r) onOpenRoute(r);
              }
            }}
          />
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {loading && (
            <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">
              Searching…
            </div>
          )}
          {nothing && (
            <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">
              No results
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}:${r.id}`}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${i === sel ? 'bg-[var(--bg-subtle)]' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => onOpenRoute(r)}
            >
              <div>
                <div className="font-medium">{r.title}</div>
                {r.subtitle && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    {r.subtitle}
                  </div>
                )}
              </div>
              <div className="text-xs rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[var(--text-tertiary)]">
                {r.type}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
