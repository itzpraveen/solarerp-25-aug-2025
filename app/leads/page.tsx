'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import Skeleton from '~/components/ui/Skeleton';
import { useToast } from '~/components/ui/ToastProvider';
import EmptyState from '~/components/ui/EmptyState';
import { isPhone, required } from '@/lib/validation';
import { PROGRAM_ALLOWED_SYSTEMS, type ProgramType } from '@/lib/program';
import { ensureProfileIfMissing } from '@/lib/ensureProfileClient';
import BranchSelect from '~/components/BranchSelect';
import RequireOwner from '~/components/RequireOwner';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import Segmented from '~/components/ui/Segmented';

function LeadsPageInner() {
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const search = useSearchParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [source, setSource] = useState<string>('');
  // Address input for quick add; previously labelled "Place"
  const [addressInput, setAddressInput] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [nextFollowUp, setNextFollowUp] = useState<string>('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<any>({
    address: '', // Site address / location (used for both customer.address and job.location)
    program_type: 'PM_Surya',
    system_type: 'On-grid',
    capacity_kw: 1,
    roof_type: '',
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [branchId, setBranchId] = useState<string | 'all'>('all');
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [kpis, setKpis] = useState<any | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [jobsLeadCount, setJobsLeadCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [dedupeMode, setDedupeMode] = useState<'create' | 'skip' | 'update'>(
    'create',
  );
  // Pagination & density
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dense, setDense] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  // Filters
  const [filterMode, setFilterMode] = useState<'open' | 'all' | 'converted'>(
    'open',
  );
  const initialDue =
    (search.get('due') || '').toLowerCase() === 'today' ||
    (search.get('due') || '') === '1';
  const [dueOnly, setDueOnly] = useState(initialDue);
  // Branches for add/edit choices
  const [branches, setBranches] = useState<any[]>([]);
  // Per-add override: use selected branch, specific branch, or unassigned
  const [addBranchOverride, setAddBranchOverride] =
    useState<string>('use-selected');
  const { toast } = useToast();
  // Helper: fetch current user's tenant id to avoid maybeSingle errors when multiple profiles exist
  const getTenantId = async (): Promise<string | null> => {
    // Ensure a profile exists; if not, try to create when self‑signup is on
    const ensured = await ensureProfileIfMissing(supabase);
    return ensured;
  };

  useEffect(() => {
    (async () => {
    const tenantId = await getTenantId();
    if (!tenantId) return;
      const { data: br } = await supabase
        .from('branches')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .order('name');
      const map: Record<string, string> = {};
      for (const b of (br as any[]) || []) map[b.id] = b.name || '—';
      setBranchNames(map);
      setBranches((br as any[]) || []);
    })();
  }, []);

  // Load KPI aggregates server-side to avoid large client fetches
  useEffect(() => {
    (async () => {
      setKpiLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) {
          setKpis(null);
          setJobsLeadCount(null);
          setKpiLoading(false);
          return;
        }
        const url =
          branchId === 'all'
            ? '/api/leads/kpis'
            : `/api/leads/kpis?branchId=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const out = await res.json();
        if (res.ok && out?.ok) setKpis(out);
        else setKpis(null);
        // Also compute Jobs in Lead stage (pipeline) count for clarity
        try {
          let jq = supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Lead');
          if (branchId !== 'all') jq = jq.eq('branch_id', branchId as string);
          const { count } = await jq;
          setJobsLeadCount(count || 0);
        } catch {
          setJobsLeadCount(null);
        }
      } catch {
        setKpis(null);
        setJobsLeadCount(null);
      } finally {
        setKpiLoading(false);
      }
    })();
  }, [branchId]);

  // Realtime updates for leads
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for global header branch changes
  useEffect(() => {
    const h = (e: any) => {
      const v = e?.detail?.value as string | 'all' | undefined;
      if (v !== undefined) setBranchId(v);
    };
    window.addEventListener('branch-change', h as any);
    return () => window.removeEventListener('branch-change', h as any);
  }, []);

  const load = async () => {
    setLoadingList(true);
    let q = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
    if (branchId !== 'all') q = q.eq('branch_id', branchId as string);
    if (filterMode === 'open')
      q = q
        .neq('status', 'Converted')
        .neq('status', 'Closed')
        .neq('status', 'Lost');
    else if (filterMode === 'converted') q = q.eq('status', 'Converted');
    if (dueOnly) q = q.eq('next_follow_up_date', todayStr);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) {
      // Surface server-side error details and show a friendly UI error
      try {
        // PostgrestError has message/code but sometimes logs as {}
        const msg =
          (error as any)?.message || (error as any)?.hint || 'Unknown error';
        const code = (error as any)?.code;
        console.error('Failed to load leads:', {
          code,
          message: msg,
          raw: error,
        });
        setErr(`Failed to load leads: ${msg}${code ? ` (${code})` : ''}`);
      } catch (e) {
        console.error('Failed to load leads (unserializable error):', error);
        setErr('Failed to load leads. Please try again.');
      }
      setLoadingList(false);
      return;
    }
    let rows: any[] = (data as any[]) || [];
    setTotalCount(count || 0)

    setLeads(rows);
    setLoadingList(false);
  };

  useEffect(() => {
    // Avoid querying before auth session is ready to prevent noisy 401 errors
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) load();
    });
  }, [branchId, filterMode, dueOnly])
  // reset to first page on filter change
  useEffect(()=>{ setPage(1); }, [branchId, filterMode, dueOnly]);
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{ if (data.session) load();}); }, [page, pageSize]);

  const add = async () => {
    setErr(null);
    if (!required(name)) return setErr('Name is required');
    if (!isPhone(phone)) return setErr('Valid phone required');
    setAdding(true);
    const tenantId = await getTenantId();
    if (!tenantId) {
      setAdding(false);
      return setErr('Profile not ready');
    }
    const branchForInsert =
      addBranchOverride === 'use-selected'
        ? branchId !== 'all'
          ? (branchId as string)
          : null
        : addBranchOverride === 'none'
          ? null
          : (addBranchOverride as string);
    const { error } = await supabase.from('leads').insert({
      tenant_id: tenantId,
      date: new Date().toISOString().slice(0, 10),
      name,
      phone,
      source: source || null,
      interested_capacity_kw: capacity,
      address: addressInput || null,
      notes: remarks || null,
      next_follow_up_date: nextFollowUp || null,
      status: 'New',
      branch_id: branchForInsert,
    });
    setAdding(false);
    if (error) {
      setErr(error.message);
      setAdding(false);
      return;
    }
    setName('');
    setPhone('');
    setCapacity(1);
    setSource('');
    setAddressInput('');
    setRemarks('');
    setNextFollowUp('');
    setAddBranchOverride('use-selected');
    load();
    toast({ title: 'Lead added', variant: 'success' });
  };

  const csvLeads =
    'Date,Name,Phone,Source,Capacity,Status\n' +
    leads
      .map((l) =>
        [
          l.date || '',
          l.name || '',
          l.phone || '',
          l.source || '',
          l.interested_capacity_kw || '',
          l.status || '',
        ].join(','),
      )
      .join('\n');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Leads</h1>
        <div className="min-w-[220px]">
          <BranchSelect value={branchId} onChange={setBranchId} />
        </div>
      </div>
      {/* Simple filters: default to Open, optional Due today */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          options={[
            { label: 'Open', value: 'open' },
            { label: 'All', value: 'all' },
            { label: 'Converted', value: 'converted' },
          ]}
          value={filterMode}
          onChange={(v) => setFilterMode(v as any)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
          />
          Due today
        </label>
      </div>
      {/* Quick add: single field capture */}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <Input
            className="md:col-span-2"
            placeholder="Quick add: Name or Phone"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Capacity kW"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <Button
            onClick={async () => {
              // Parse single-field entry if phone omitted
              let nm = name.trim();
              let ph = phone.trim();
              if (!ph && /\d{7,}/.test(nm)) {
                // If digits present in name field, assume it is phone
                ph = nm.replace(/[^\d+]/g, '');
                nm = 'Lead';
              }
              setErr(null);
              if (!required(nm)) {
                setErr('Name or phone required');
                return;
              }
              if (ph && !isPhone(ph)) {
                setErr('Enter a valid phone');
                return;
              }
              setAdding(true);
              const tenantId = await getTenantId();
              if (!tenantId) {
                setAdding(false);
                setErr('Profile not ready');
                return;
              }
              const today = new Date().toISOString().slice(0, 10);
              const bId = branchId !== 'all' ? (branchId as string) : null;
              await supabase.from('leads').insert({
                tenant_id: tenantId,
                date: today,
                name: nm || null,
                phone: ph || null,
                interested_capacity_kw: capacity || null,
                next_follow_up_date: today,
                status: 'New',
                branch_id: bId,
              });
              setAdding(false);
              setName('');
              setPhone('');
              setCapacity(1);
              load();
            }}
            loading={adding}
          >
            Quick Add
          </Button>
        </div>
      </Card>
      {/* KPI tiles (server-side aggregates) */}
      {!kpiLoading &&
        kpis &&
        (kpis.scope === 'all' ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {kpis.perBranch.map((b: any) => (
              <div key={b.branchId} className="rounded border bg-white p-3">
                <div className="text-sm font-medium">{b.name}</div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                  <div className="text-gray-600">Leads: {b.total}</div>
                  <div className="text-gray-600">Open: {b.open}</div>
                  <div
                    className={
                      b.dueToday > 0 ? 'text-red-600' : 'text-gray-600'
                    }
                  >
                    Due today: {b.dueToday}
                  </div>
                  <div
                    className={b.overdue > 0 ? 'text-red-600' : 'text-gray-600'}
                  >
                    Overdue: {b.overdue}
                  </div>
                  <div className="text-gray-600">
                    New this week: {b.newWeek}
                  </div>
                </div>
              </div>
            ))}
            {(kpis.unassigned?.total || 0) > 0 && (
              <div className="rounded border bg-white p-3">
                <div className="text-sm font-medium">Unassigned</div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                  <div className="text-gray-600">
                    Leads: {kpis.unassigned.total}
                  </div>
                  <div className="text-gray-600">
                    Open: {kpis.unassigned.open}
                  </div>
                  <div
                    className={
                      kpis.unassigned.dueToday > 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }
                  >
                    Due today: {kpis.unassigned.dueToday}
                  </div>
                  <div
                    className={
                      kpis.unassigned.overdue > 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }
                  >
                    Overdue: {kpis.unassigned.overdue}
                  </div>
                  <div className="text-gray-600">
                    New this week: {kpis.unassigned.newWeek}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-semibold">{kpis.total}</div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Open</div>
              <div className="text-lg font-semibold">{kpis.open}</div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Due today</div>
              <div
                className={`text-lg font-semibold ${kpis.dueToday > 0 ? 'text-red-600' : ''}`}
              >
                {kpis.dueToday}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Overdue</div>
              <div
                className={`text-lg font-semibold ${kpis.overdue > 0 ? 'text-red-600' : ''}`}
              >
                {kpis.overdue}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">New this week</div>
              <div className="text-lg font-semibold">{kpis.newWeek}</div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Converted</div>
              <div className="text-lg font-semibold">{kpis.converted}</div>
            </div>
          </div>
        ))}
      {/* Clarification: Jobs pipeline Lead-stage count can differ from Leads */}
      {!kpiLoading && jobsLeadCount != null && (
        <div className="rounded border bg-white p-3 text-center">
          <div className="text-xs text-gray-500">Jobs in Lead Stage</div>
          <div className="text-lg font-semibold">{jobsLeadCount}</div>
        </div>
      )}
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Address"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Source…</option>
            <option>Phone</option>
            <option>Walk-in</option>
            <option>Referral</option>
            <option>Website</option>
            <option>WhatsApp</option>
            <option>Facebook</option>
            <option>Other</option>
          </select>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Capacity kW"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <Input
            type="date"
            placeholder="Next follow-up"
            value={nextFollowUp}
            onChange={(e) => setNextFollowUp(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={addBranchOverride}
            onChange={(e) => setAddBranchOverride(e.target.value)}
            title="Assign branch"
          >
            <option value="use-selected">
              Branch:{' '}
              {branchId === 'all'
                ? 'Use filter or Unassigned'
                : branchNames[branchId as string] || 'Selected'}
            </option>
            <option value="none">Unassigned</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || '—'}
              </option>
            ))}
          </select>
          <Input
            placeholder="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={add} loading={adding}>
              Add Lead
            </Button>
            <a
              className="rounded border px-3 py-2 text-sm"
              href={
                'data:text/csv;charset=utf-8,' + encodeURIComponent(csvLeads)
              }
              download="leads.csv"
            >
              Export CSV
            </a>
            <a
              className="rounded border px-3 py-2 text-sm"
              href="/api/leads/template"
            >
              Template (.xlsx)
            </a>
          </div>
        </div>
      </Card>
      {/* Import from Excel */}
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Import leads from Excel (.xlsx)
            </div>
            <div className="text-xs text-gray-600">
              Columns supported: Name, Phone, Email, Source, Capacity (kW),
              Date, Next Follow-up, Branch
            </div>
            <div className="text-xs text-gray-600">
              Branch column maps by name. If missing, uses selected branch
              above. Enable create to auto-create branches by name.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">Dedupe:</label>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={dedupeMode}
                onChange={(e) => setDedupeMode(e.target.value as any)}
              >
                <option value="create">Create anyway</option>
                <option value="skip">Skip duplicates</option>
                <option value="update">Update existing</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input id="createBranches" type="checkbox" defaultChecked />
                Auto-create branches
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="leadFile"
              type="file"
              accept=".xlsx"
              className="text-sm"
            />
            <Button
              onClick={async () => {
                const el = document.getElementById(
                  'leadFile',
                ) as HTMLInputElement | null;
                const cb = document.getElementById(
                  'createBranches',
                ) as HTMLInputElement | null;
                const f = el?.files?.[0];
                if (!f) {
                  alert('Pick an .xlsx file');
                  return;
                }
                setImporting(true);
                setImportResult(null);
                try {
                  const fd = new FormData();
                  fd.append('file', f);
                  fd.append('mode', dedupeMode);
                  if (branchId !== 'all')
                    fd.append('branchId', branchId as string);
                  fd.append('createBranches', cb?.checked ? 'true' : 'false');
                  const { data: session } = await supabase.auth.getSession();
                  const token = session.session?.access_token;
                  const res = await fetch('/api/leads/import', {
                    method: 'POST',
                    headers: token
                      ? { Authorization: `Bearer ${token}` }
                      : undefined,
                    body: fd,
                  });
                  const out = await res.json();
                  if (!res.ok || !out?.ok)
                    throw new Error(out?.error || 'Import failed');
                  setImportResult(out);
                  load();
                  toast({
                    title: 'Import complete',
                    description: `${out.created} created, ${out.updated} updated, ${out.skipped} skipped.`,
                    variant: 'success',
                  });
                } catch (e: any) {
                  const msg = e?.message || String(e);
                  setImportResult({ ok: false, error: msg });
                  toast({
                    title: 'Import failed',
                    description: msg,
                    variant: 'error',
                  });
                } finally {
                  setImporting(false);
                }
              }}
              loading={importing}
            >
              Import
            </Button>
          </div>
        </div>
        {importResult && (
          <div
            className={`mt-2 rounded border ${importResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} p-2 text-sm`}
          >
            {importResult.ok ? (
              <div>
                Imported {importResult.created} created, {importResult.updated}{' '}
                updated, {importResult.skipped} skipped.
                {importResult.errors?.length ? (
                  <div className="mt-1 text-xs text-red-700">
                    Errors: {importResult.errors.length} (first 3 shown)
                    <ul className="list-disc pl-5">
                      {importResult.errors
                        .slice(0, 3)
                        .map((e: any, i: number) => (
                          <li key={i}>
                            Row {e.row}: {e.error}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-red-700">
                {importResult.error || 'Import failed'}
              </div>
            )}
          </div>
        )}
      </Card>
      {loadingList ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Capture interested customers so you can follow-up and convert."
        />
      ) : (
        <>
          {/* Bulk actions */}
          {Object.values(selected).some(Boolean) && (
            <div className="flex flex-wrap items-center gap-2 rounded border bg-white p-2 text-sm">
              <span className="text-gray-700">
                Bulk actions for{' '}
                {Object.values(selected).filter(Boolean).length} selected:
              </span>
              <select
                className="rounded border px-2 py-1"
                onChange={async (e) => {
                  const val = e.target.value;
                  e.currentTarget.selectedIndex = 0;
                  if (!val) return;
                  const ids = Object.entries(selected)
                    .filter(([k, v]) => v)
                    .map(([k]) => k);
                  if (val.startsWith('branch:')) {
                    const id = val.slice('branch:'.length);
                    await supabase
                      .from('leads')
                      .update({ branch_id: id || null })
                      .in('id', ids);
                    toast({ title: 'Branch assigned', variant: 'success' });
                  } else if (
                    val === 'status:Converted' ||
                    val === 'status:Lost'
                  ) {
                    await supabase
                      .from('leads')
                      .update({ status: val.split(':')[1] })
                      .in('id', ids);
                    toast({ title: 'Status updated', variant: 'success' });
                  } else if (val === 'followup:today') {
                    const today = new Date().toISOString().slice(0, 10);
                    await supabase
                      .from('leads')
                      .update({ next_follow_up_date: today })
                      .in('id', ids);
                    toast({
                      title: 'Follow-up set to today',
                      variant: 'success',
                    });
                  }
                  setSelected({});
                  load();
                }}
              >
                <option value="">Bulk action…</option>
                <option value="followup:today">Next Follow-up: today</option>
                <option value="status:Converted">Mark Converted</option>
                <option value="status:Lost">Mark Lost</option>
                <option disabled>Assign branch…</option>
                <option value="branch:">Unassigned</option>
                {branches.map((b) => (
                  <option key={b.id} value={`branch:${b.id}`}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="rounded border bg-white overflow-x-auto">
            <div className="flex items-center justify-between p-2 text-xs text-gray-600 sticky top-0 bg-white z-10 border-b">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={dense} onChange={(e)=>setDense(e.target.checked)} /> Compact
              </label>
              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <select className="rounded border px-2 py-1" value={pageSize} onChange={(e)=>{ setPage(1); setPageSize(Number(e.target.value)); }}>
                  {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <table className={`w-full text-sm ${dense ? 'table-dense' : ''}`}>
              <thead>
                <tr className="border-b bg-gray-50 text-left sticky top-8">
                  <th className="p-2">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const v = e.target.checked;
                        const map: Record<string, boolean> = {};
                        (leads || []).forEach((l) => {
                          if (!(l as any)._jobOnly) map[l.id] = v;
                        });
                        setSelected(map);
                      }}
                    />
                  </th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Address</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Capacity (kW)</th>
                  <th className="p-2">Next Follow-up</th>
                  <th className="p-2">Last Contacted</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Branch</th>
                  <th className="p-2">Remarks</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <React.Fragment key={l.id}>
                    <tr className="border-b">
                      <td className="p-2">
                        {(l as any)._jobOnly ? (
                          <input
                            type="checkbox"
                            disabled
                            title="Job card (read-only)"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={!!selected[l.id]}
                            onChange={(e) =>
                              setSelected({
                                ...selected,
                                [l.id]: e.target.checked,
                              })
                            }
                          />
                        )}
                      </td>
                      <td className="p-2">{l.date || '—'}</td>
                      {editing === l.id ? (
                        <>
                          <td className="p-2">
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={editForm.phone}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  phone: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={editForm.address || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  address: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <select
                              className="rounded border px-3 py-2 w-full"
                              value={editForm.source || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  source: e.target.value,
                                })
                              }
                            >
                              <option value="">Source…</option>
                              <option>Phone</option>
                              <option>Walk-in</option>
                              <option>Referral</option>
                              <option>Website</option>
                              <option>WhatsApp</option>
                              <option>Facebook</option>
                              <option>Other</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={editForm.interested_capacity_kw || 0}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  interested_capacity_kw: Number(
                                    e.target.value,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={editForm.next_follow_up_date || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  next_follow_up_date: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {l.last_contacted_at || '—'}
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {l.status || '—'}
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full rounded border px-3 py-2"
                              value={editForm.branch_id || 'none'}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  branch_id:
                                    e.target.value === 'none'
                                      ? null
                                      : e.target.value,
                                })
                              }
                            >
                              <option value="none">Unassigned</option>
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name || '—'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input
                              value={editForm.notes || ''}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  notes: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <Button
                              size="sm"
                              onClick={async () => {
                                await supabase
                                  .from('leads')
                                  .update({
                                    name: editForm.name,
                                    phone: editForm.phone,
                                    source: editForm.source || null,
                                    interested_capacity_kw:
                                      editForm.interested_capacity_kw,
                                    address: editForm.address || null,
                                    notes: editForm.notes || null,
                                    next_follow_up_date:
                                      editForm.next_follow_up_date || null,
                                    branch_id: editForm.branch_id || null,
                                  })
                                  .eq('id', l.id);
                                setEditing(null);
                                load();
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2">{l.name || '—'}</td>
                          <td className="p-2">{l.phone || '—'}{l.phone && (
                            <span className="ml-2 whitespace-nowrap">
                              <a className="underline text-blue-600" href={`tel:${String(l.phone).replace(/\\D+/g, '')}`} title="Call">📞</a>
                              <a className="ml-1 underline text-green-600" href={`https://wa.me/${String(l.phone).replace(/\\D+/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp">🟢</a>
                            </span>
                          )}
                          </td>
                          <td className="p-2">{l.address || '—'}</td>
                          <td className="p-2">{l.source || '—'}</td>
                          <td className="p-2">
                            {l.interested_capacity_kw ?? '—'}
                          </td>
                          <td className="p-2">
                            <span
                              className={
                                l.next_follow_up_date &&
                                l.next_follow_up_date <= todayStr
                                  ? 'text-red-600 font-medium'
                                  : 'text-gray-700'
                              }
                            >
                              {l.next_follow_up_date || '—'}
                            </span>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-600">
                              {['+1d', '+3d', '+7d'].map((lbl) => (
                                <button
                                  key={lbl}
                                  className="rounded border px-1 py-0.5"
                                  title={`Snooze ${lbl}`}
                                  onClick={async () => {
                                    const base =
                                      l.next_follow_up_date || todayStr;
                                    const d = new Date(base);
                                    const add =
                                      lbl === '+1d' ? 1 : lbl === '+3d' ? 3 : 7;
                                    d.setDate(d.getDate() + add);
                                    await supabase
                                      .from('leads')
                                      .update({
                                        next_follow_up_date: d
                                          .toISOString()
                                          .slice(0, 10),
                                      })
                                      .eq('id', l.id);
                                    load();
                                  }}
                                >
                                  {lbl}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {l.last_contacted_at || '—'}
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {l.status || '—'}
                          </td>
                          <td className="p-2 text-xs">
                            {l.branch_id ? (
                              <span className="inline-block rounded-full border px-2 py-0.5 text-gray-700">
                                {branchNames[l.branch_id] || '—'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-2 truncate max-w-[240px]">
                            <span title={l.notes || ''}>{l.notes || '—'}</span>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {(l as any)._jobOnly ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    // Create a corresponding lead and link this job
                                    const tenantId = await getTenantId();
                                    if (!tenantId) return alert('Profile not ready');
                                    const today = new Date()
                                      .toISOString()
                                      .slice(0, 10);
                                    const { data: lead } = await supabase
                                      .from('leads')
                                      .insert({
                                        tenant_id: tenantId,
                                        date: (l as any).date || today,
                                        name: (l as any).name || 'Lead',
                                        phone: (l as any).phone || null,
                                        address: (l as any).address || null,
                                        interested_capacity_kw:
                                          (l as any).interested_capacity_kw ||
                                          null,
                                        status: 'Converted',
                                        source: 'Job',
                                        branch_id:
                                          (l as any).branch_id ||
                                          (branchId !== 'all'
                                            ? (branchId as string)
                                            : null),
                                      })
                                      .select('id')
                                      .single();
                                    const newLeadId = (lead as any)
                                      ?.id as string;
                                    if (newLeadId && (l as any)._jobId) {
                                      await supabase
                                        .from('jobs')
                                        .update({ lead_id: newLeadId })
                                        .eq('id', (l as any)._jobId);
                                      toast({
                                        title: 'Linked job to lead',
                                        variant: 'success',
                                      });
                                      load();
                                    }
                                  }}
                                >
                                  Link Lead
                                </Button>
                                <a
                                  href={`/jobs/${(l as any)._jobId}`}
                                  className="ml-2 rounded border px-2 py-1 text-sm"
                                >
                                  Open Job
                                </a>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditing(l.id);
                                    setEditForm(l);
                                  }}
                                >
                                  Edit
                                </Button>
                              </>
                            )}
                            {!(l as any)._jobOnly && (
                              <RequireOwner>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="ml-2"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Delete lead',
                                      description:
                                        'Are you sure you want to permanently delete this lead?',
                                      confirmText: 'Delete',
                                    });
                                    if (!ok) return;
                                    await supabase
                                      .from('leads')
                                      .delete()
                                      .eq('id', l.id);
                                    load();
                                  }}
                                >
                                  Delete
                                </Button>
                              </RequireOwner>
                            )}
                            {!(l as any)._jobOnly && (
                              <Button
                                size="sm"
                                className="ml-2"
                                onClick={() => {
                                  // confirmation dialog
                                  confirm({
                                    title: 'Convert lead',
                                    description: 'Convert this lead to a Job?',
                                    confirmText: 'Convert',
                                  }).then((ok) => {
                                    if (!ok) return;
                                    setConvertingId(l.id);
                                    setConvertForm({
                                      // Prefill from lead.address so users don't have to retype
                                      address: (l as any)?.address || '',
                                      program_type: 'PM_Surya',
                                      system_type: 'On-grid',
                                      capacity_kw:
                                        l.interested_capacity_kw || 1,
                                      location: '',
                                      roof_type: '',
                                    });
                                  });
                                }}
                              >
                                Convert
                              </Button>
                            )}
                            {/* Removed 'Followed up' button to reduce clutter */}
                            {l.phone && (
                              <a
                                href={`https://wa.me/${String(l.phone).replace(/\D+/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 rounded border px-2 py-1 text-sm"
                              >
                                WhatsApp
                              </a>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={async () => {
                                const d = prompt(
                                  'Set next follow-up (YYYY-MM-DD):',
                                  l.next_follow_up_date || todayStr,
                                );
                                if (!d) return;
                                await supabase
                                  .from('leads')
                                  .update({ next_follow_up_date: d })
                                  .eq('id', l.id);
                                load();
                              }}
                            >
                              Set Next
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={async () => {
                                await supabase
                                  .from('leads')
                                  .update({
                                    last_contacted_at: todayStr,
                                    status: 'Contacted',
                                  })
                                  .eq('id', l.id);
                                load();
                              }}
                            >
                              Mark contacted
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                    {convertingId === l.id && (
                      <tr className="bg-gray-50" key={`${l.id}-convert`}>
                        <td className="p-2" colSpan={8}>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                            {/* Hide Address input if the lead already has an address */}
                            {!((l as any)?.address) && (
                              <Input
                                className="md:col-span-2"
                                placeholder="Address"
                                value={convertForm.address}
                                onChange={(e) =>
                                  setConvertForm({
                                    ...convertForm,
                                    address: e.target.value,
                                  })
                                }
                              />
                            )}
                            <select
                              className="rounded border px-3 py-2"
                              value={convertForm.program_type}
                              onChange={(e) => {
                                const p = e.target.value as ProgramType;
                                const allowed = PROGRAM_ALLOWED_SYSTEMS[p];
                                setConvertForm((prev: any) => ({
                                  ...prev,
                                  program_type: p,
                                  system_type: allowed.includes(
                                    prev.system_type,
                                  )
                                    ? prev.system_type
                                    : allowed[0],
                                }));
                              }}
                            >
                              <option value="PM_Surya">PM Surya</option>
                              <option value="Commercial">Commercial</option>
                            </select>
                            <select
                              className="rounded border px-3 py-2"
                              value={convertForm.system_type}
                              onChange={(e) =>
                                setConvertForm({
                                  ...convertForm,
                                  system_type: e.target.value,
                                })
                              }
                            >
                              {PROGRAM_ALLOWED_SYSTEMS[
                                convertForm.program_type as ProgramType
                              ].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              placeholder="Capacity kW"
                              value={convertForm.capacity_kw}
                              onChange={(e) =>
                                setConvertForm({
                                  ...convertForm,
                                  capacity_kw: Number(e.target.value),
                                })
                              }
                            />
                            {/* Location consolidated with Address to avoid duplication */}
                            <Input
                              placeholder="Roof Type"
                              value={convertForm.roof_type}
                              onChange={(e) =>
                                setConvertForm({
                                  ...convertForm,
                                  roof_type: e.target.value,
                                })
                              }
                            />
                            <div className="md:col-span-6 flex gap-2">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  const tenantId = await getTenantId();
                                  if (!tenantId) return alert('Profile not ready');
                                  // Reuse existing customer by phone within tenant if present, else create
                                  let customerId: string | null = null;
                                  if (l.phone) {
                                    const { data: existing } = await supabase
                                      .from('customers')
                                      .select('id')
                                      .eq('tenant_id', tenantId)
                                      .eq('phone', l.phone)
                                      .maybeSingle();
                                    if (existing?.id)
                                      customerId = existing.id as string;
                                  }
                                  if (!customerId) {
                                    const { data: cust } = await supabase
                                      .from('customers')
                                      .insert({
                                        tenant_id: tenantId,
                                        name: l.name,
                                        phone: l.phone || null,
                                        address:
                                          convertForm.address ||
                                          (l as any)?.address ||
                                          null,
                                      })
                                      .select('id')
                                      .single();
                                    customerId = (cust as any)!.id as string;
                                  }
                                  const today = new Date()
                                    .toISOString()
                                    .slice(0, 10);
                                  const { data: job } = await supabase
                                    .from('jobs')
                                    .insert({
                                      tenant_id: tenantId,
                                      customer_id: customerId!,
                                      lead_id: l.id,
                                      system_type: convertForm.system_type,
                                      program_type: convertForm.program_type,
                                      status: 'Lead',
                                      capacity_kw: convertForm.capacity_kw,
                                      location:
                                        convertForm.address ||
                                        (l as any)?.address ||
                                        null,
                                      roof_type: convertForm.roof_type || null,
                                      date_lead: (l as any)?.date || today,
                                      branch_id:
                                        (l as any)?.branch_id ||
                                        (branchId !== 'all' ? branchId : null),
                                    })
                                    .select('id')
                                    .single();
                                  await supabase
                                    .from('leads')
                                    .update({ status: 'Converted' })
                                    .eq('id', l.id);
                                  window.location.href = `/jobs/${(job as any)!.id}`;
                                }}
                              >
                                Create
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConvertingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {/* Bottom pager */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
            <div>
              Page {page} of {totalPages} • {totalCount} leads
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                aria-label="First page"
                title="First"
              >
                « First
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                title="Previous"
              >
                ‹ Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                title="Next"
              >
                Next ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="Last page"
                title="Last"
              >
                Last »
              </Button>
            </div>
          </div>
          {Object.values(selected).some(Boolean) && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ids = Object.keys(selected).filter((k) => selected[k]);
                  await supabase
                    .from('leads')
                    .update({ status: 'Closed' })
                    .in('id', ids);
                  setSelected({});
                  load();
                }}
              >
                Mark selected Closed
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div />}> 
      <LeadsPageInner />
    </Suspense>
  );
}
