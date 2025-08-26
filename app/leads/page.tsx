'use client';
import React, { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';
import { isPhone, required } from '@/lib/validation';
import { PROGRAM_ALLOWED_SYSTEMS, type ProgramType } from '@/lib/program';
import BranchSelect from '~/components/BranchSelect';

export default function LeadsPage() {
  const supabase = supabaseBrowser();
  const [leads, setLeads] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [source, setSource] = useState<string>('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<any>({
    address: '',
    program_type: 'PM_Surya',
    system_type: 'On-grid',
    capacity_kw: 1,
    location: '',
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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [dedupeMode, setDedupeMode] = useState<'create' | 'skip' | 'update'>('create');

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      if (!prof?.tenant_id) return;
      const { data: br } = await supabase
        .from('branches')
        .select('id,name')
        .eq('tenant_id', (prof as any).tenant_id)
        .order('name');
      const map: Record<string, string> = {};
      for (const b of (br as any[]) || []) map[b.id] = b.name || '—';
      setBranchNames(map);
    })();
  }, []);

  // Load KPI aggregates server-side to avoid large client fetches
  useEffect(() => {
    (async () => {
      setKpiLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) { setKpis(null); setKpiLoading(false); return; }
        const url = branchId === 'all' ? '/api/leads/kpis' : `/api/leads/kpis?branchId=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const out = await res.json();
        if (res.ok && out?.ok) setKpis(out);
        else setKpis(null);
      } catch {
        setKpis(null);
      } finally {
        setKpiLoading(false);
      }
    })();
  }, [branchId]);

  const load = async () => {
    let q = supabase.from('leads').select('*').order('date', { ascending: false });
    if (branchId !== 'all') q = q.eq('branch_id', branchId as string);
    const { data, error } = await q;
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
      return;
    }
    setLeads(data || []);
  };

  useEffect(() => {
    // Avoid querying before auth session is ready to prevent noisy 401 errors
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) load();
    });
  }, [branchId]);

  const add = async () => {
    setErr(null);
    if (!required(name)) return setErr('Name is required');
    if (!isPhone(phone)) return setErr('Valid phone required');
    setAdding(true);
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    if (pErr || !prof?.tenant_id) {
      setAdding(false);
      return setErr('Profile not ready');
    }
    const { error } = await supabase
      .from('leads')
      .insert({
        tenant_id: prof!.tenant_id,
        date: new Date().toISOString().slice(0, 10),
        name,
        phone,
        source: source || null,
        interested_capacity_kw: capacity,
        status: 'New',
        branch_id: branchId !== 'all' ? (branchId as string) : null,
      });
    setAdding(false);
    if (error) return setErr(error.message);
    setName('');
    setPhone('');
    setCapacity(1);
    setSource('');
    load();
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
      {/* KPI tiles (server-side aggregates) */}
      {!kpiLoading && kpis && (
        kpis.scope === 'all' ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {kpis.perBranch.map((b: any) => (
              <div key={b.branchId} className="rounded border bg-white p-3">
                <div className="text-sm font-medium">{b.name}</div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                  <div className="text-gray-600">Leads: {b.total}</div>
                  <div className={b.dueToday > 0 ? 'text-red-600' : 'text-gray-600'}>Due today: {b.dueToday}</div>
                  <div className={b.overdue > 0 ? 'text-red-600' : 'text-gray-600'}>Overdue: {b.overdue}</div>
                  <div className="text-gray-600">New this week: {b.newWeek}</div>
                </div>
              </div>
            ))}
            {(kpis.unassigned?.total || 0) > 0 && (
              <div className="rounded border bg-white p-3">
                <div className="text-sm font-medium">Unassigned</div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                  <div className="text-gray-600">Leads: {kpis.unassigned.total}</div>
                  <div className={kpis.unassigned.dueToday > 0 ? 'text-red-600' : 'text-gray-600'}>Due today: {kpis.unassigned.dueToday}</div>
                  <div className={kpis.unassigned.overdue > 0 ? 'text-red-600' : 'text-gray-600'}>Overdue: {kpis.unassigned.overdue}</div>
                  <div className="text-gray-600">New this week: {kpis.unassigned.newWeek}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-semibold">{kpis.total}</div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Due today</div>
              <div className={`text-lg font-semibold ${kpis.dueToday > 0 ? 'text-red-600' : ''}`}>{kpis.dueToday}</div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Overdue</div>
              <div className={`text-lg font-semibold ${kpis.overdue > 0 ? 'text-red-600' : ''}`}>{kpis.overdue}</div>
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
        )
      )}
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
          </div>
        </div>
      </Card>
      {/* Import from Excel */}
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm font-medium">Import leads from Excel (.xlsx)</div>
            <div className="text-xs text-gray-600">Columns supported: Name, Phone, Email, Source, Capacity (kW), Date, Next Follow-up, Branch</div>
            <div className="text-xs text-gray-600">Branch column maps by name. If missing, uses selected branch above. Enable create to auto-create branches by name.</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">Dedupe:</label>
              <select className="rounded border px-2 py-1 text-sm" value={dedupeMode} onChange={(e) => setDedupeMode(e.target.value as any)}>
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
            <input id="leadFile" type="file" accept=".xlsx" className="text-sm" />
            <Button
              onClick={async () => {
                const el = document.getElementById('leadFile') as HTMLInputElement | null;
                const cb = document.getElementById('createBranches') as HTMLInputElement | null;
                const f = el?.files?.[0];
                if (!f) { alert('Pick an .xlsx file'); return; }
                setImporting(true); setImportResult(null);
                try {
                  const fd = new FormData();
                  fd.append('file', f);
                  fd.append('mode', dedupeMode);
                  if (branchId !== 'all') fd.append('branchId', branchId as string);
                  fd.append('createBranches', cb?.checked ? 'true' : 'false');
                  const { data: session } = await supabase.auth.getSession();
                  const token = session.session?.access_token;
                  const res = await fetch('/api/leads/import', {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: fd,
                  });
                  const out = await res.json();
                  if (!res.ok || !out?.ok) throw new Error(out?.error || 'Import failed');
                  setImportResult(out);
                  load();
                } catch (e: any) {
                  setImportResult({ ok: false, error: e?.message || String(e) });
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
          <div className={`mt-2 rounded border ${importResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} p-2 text-sm`}>
            {importResult.ok ? (
              <div>
                Imported {importResult.created} created, {importResult.updated} updated, {importResult.skipped} skipped.
                {importResult.errors?.length ? (
                  <div className="mt-1 text-xs text-red-700">Errors: {importResult.errors.length} (first 3 shown)
                    <ul className="list-disc pl-5">
                      {importResult.errors.slice(0,3).map((e:any, i:number) => (
                        <li key={i}>Row {e.row}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-red-700">{importResult.error || 'Import failed'}</div>
            )}
          </div>
        )}
      </Card>
      {leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Capture interested customers so you can follow-up and convert."
        />
      ) : (
        <>
          <div className="rounded border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const v = e.target.checked;
                        const map: Record<string, boolean> = {};
                        (leads || []).forEach((l) => (map[l.id] = v));
                        setSelected(map);
                      }}
                    />
                  </th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Capacity (kW)</th>
                  <th className="p-2">Next Follow-up</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <React.Fragment key={l.id}>
                    <tr className="border-b">
                      <td className="p-2">
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
                            {l.status || '—'}
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
                          <td className="p-2">{l.phone || '—'}</td>
                          <td className="p-2">{l.source || '—'}</td>
                          <td className="p-2">
                            {l.interested_capacity_kw ?? '—'}
                          </td>
                          <td className="p-2">
                            <span className={
                              l.next_follow_up_date && l.next_follow_up_date <= todayStr
                                ? 'text-red-600 font-medium'
                                : 'text-gray-700'
                            }>
                              {l.next_follow_up_date || '—'}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {l.status || '—'}
                          </td>
                          <td className="p-2 whitespace-nowrap">
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
                            <Button
                              size="sm"
                              className="ml-2"
                              onClick={() => {
                                if (!confirm('Convert this lead to a Job?'))
                                  return;
                                setConvertingId(l.id);
                                setConvertForm({
                                  address: '',
                                  program_type: 'PM_Surya',
                                  system_type: 'On-grid',
                                  capacity_kw: l.interested_capacity_kw || 1,
                                  location: '',
                                  roof_type: '',
                                });
                              }}
                            >
                              Convert
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2"
                              onClick={async () => {
                                await supabase
                                  .from('leads')
                                  .update({ last_contacted_at: todayStr })
                                  .eq('id', l.id);
                                load();
                              }}
                            >
                              Followed up
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                    {convertingId === l.id && (
                      <tr className="bg-gray-50" key={`${l.id}-convert`}>
                        <td className="p-2" colSpan={8}>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
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
                            <select
                              className="rounded border px-3 py-2"
                              value={convertForm.program_type}
                              onChange={(e) => {
                                const p = e.target.value as ProgramType;
                                const allowed = PROGRAM_ALLOWED_SYSTEMS[p];
                                setConvertForm((prev: any) => ({
                                  ...prev,
                                  program_type: p,
                                  system_type: allowed.includes(prev.system_type)
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
                              {PROGRAM_ALLOWED_SYSTEMS[convertForm.program_type as ProgramType].map((s) => (
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
                            <Input
                              placeholder="Location/Place"
                              value={convertForm.location}
                              onChange={(e) =>
                                setConvertForm({
                                  ...convertForm,
                                  location: e.target.value,
                                })
                              }
                            />
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
                                  const { data: prof } = await supabase
                                    .from('profiles')
                                    .select('tenant_id')
                                    .maybeSingle();
                                  const tenantId = (prof as any)!
                                    .tenant_id as string;
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
                                        address: convertForm.address || null,
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
                                      location: convertForm.location || null,
                                      roof_type: convertForm.roof_type || null,
                                      date_lead: (l as any)?.date || today,
                                      branch_id: (l as any)?.branch_id || (branchId !== 'all' ? branchId : null),
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
