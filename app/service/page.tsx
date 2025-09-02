'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';

export default function ServiceTickets() {
  const supabase = supabaseBrowser();
  const [tickets, setTickets] = useState<any[]>([]);
  const [summary, setSummary] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || 0) / pageSize)),
    [totalCount, pageSize],
  );

  const load = async () => {
    setErr(null);
    setLoadingList(true);
    let q = supabase
      .from('service_tickets')
      .select('id,date,status,summary,customer_id,job_id, customers(name), jobs(id)', { count: 'exact' })
      .order('date', { ascending: false });
    const term = (debouncedSearch || '').trim();
    if (term) {
      const esc = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
      q = q.ilike('summary', `%${esc}%`);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) setErr(error.message);
    setTickets(data || []);
    setTotalCount(count || 0);
    setLoadingList(false);
    const { data: cust } = await supabase
      .from('customers')
      .select('id,name')
      .order('name');
    setCustomers(cust || []);
  };
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch]);
  useEffect(() => setPage(1), [debouncedSearch]);

  const add = async () => {
    if (!customerId) return alert('Select a customer');
    setAdding(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = (u?.user as any)?.id as string | undefined;
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid as any)
      .maybeSingle();
    if (!prof?.tenant_id) {
      setAdding(false);
      return alert('Profile not ready');
    }
    const { error } = await supabase.from('service_tickets').insert({
      tenant_id: (prof as any)!.tenant_id,
      customer_id: customerId,
      date: new Date().toISOString().slice(0, 10),
      summary,
    });
    setAdding(false);
    if (error) return alert(`Add failed: ${error.message}`);
    setSummary('');
    setCustomerId('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Service Tickets</h1>
      <div className="flex items-center justify-between text-sm">
        <input className="rounded border px-3 py-2" placeholder="Search summary…" value={search} onChange={(e)=>setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <span>Rows:</span>
          <select className="rounded border px-2 py-1" value={pageSize} onChange={(e)=>{setPage(1); setPageSize(Number(e.target.value));}}>
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="Issue summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button onClick={add} loading={adding}>
            Add
          </Button>
        </div>
      </Card>
      {loadingList ? (
        <Card><div className="p-3 text-sm text-gray-600">Loading…</div></Card>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No service tickets"
          description="Log post-install issues here for tracking and accountability."
        />
      ) : (
        <>
        <div className="text-xs text-gray-600">Page {page} of {totalPages} • {totalCount} tickets</div>
        <ul className="space-y-2">
          {tickets.map((t) => {
            const cname = Array.isArray(t.customers)
              ? t.customers?.[0]?.name || '—'
              : (t as any)?.customers?.name || '—';
            return (
              <li
                key={t.id}
                className="rounded border bg-white p-3 text-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.summary || '—'}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {cname}
                    {t.jobs?.id
                      ? ` • Job ${String(t.jobs.id).slice(0, 8)}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{t.status}</span>
                  <a
                    className="text-blue-600 text-sm"
                    href={`/service/${t.id}`}
                  >
                    Open
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
          <div>Page {page} of {totalPages} • {totalCount} tickets</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(1)}>« First</Button>
            <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹ Prev</Button>
            <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next ›</Button>
            <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>Last »</Button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
