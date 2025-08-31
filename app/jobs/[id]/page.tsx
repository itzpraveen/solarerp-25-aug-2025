'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Breadcrumbs from '~/components/Breadcrumbs';
import Button from '~/components/ui/Button';
import { JOB_STATUSES, statusLabel, type JobStatus } from '@/lib/status';
import { useToast } from '~/components/ui/ToastProvider';
import Badge from '~/components/ui/Badge';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import StageProgress from '~/components/StageProgress';
import NextActionCard from '~/components/NextActionCard';
import MilestoneTimeline from '~/components/MilestoneTimeline';
import RequiredDocs from '~/components/RequiredDocs';

type Job = any;

function JobDetailPageInner() {
  const params = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const [job, setJob] = useState<Job | null>(null);
  const [tab, setTab] = useState<
    'overview' | 'finance' | 'docs' | 'tasks' | 'proposals' | 'activity'
  >('overview');
  const search = useSearchParams();
  const [edit, setEdit] = useState<any | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, customers(name, phone, email)')
        .eq('id', params.id)
        .single();
      setJob(data as any);
      setEdit({
        location: data?.location || '',
        kseb_application_no: data?.kseb_application_no || '',
        subsidy_portal_ref: data?.subsidy_portal_ref || '',
        notes: data?.notes || '',
        date_site_survey: data?.date_site_survey || '',
        date_kseb_submit: data?.date_kseb_submit || '',
        date_install: data?.date_install || '',
        date_meter: data?.date_meter || '',
        date_handover: data?.date_handover || '',
        is_loan: Boolean((data as any)?.is_loan) || false,
      });
    })();
  }, [params.id]);

  useEffect(() => {
    const t = search.get('tab');
    if (
      t &&
      [
        'overview',
        'finance',
        'docs',
        'tasks',
        'proposals',
        'activity',
      ].includes(t)
    ) {
      setTab(t as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Job Details</h1>
        <button
          onClick={() => {
            if (history.length > 1) history.back();
            else window.location.href = '/jobs';
          }}
          className="text-sm text-blue-600"
        >
          Back
        </button>
      </div>
      {/* toasts used instead of inline flash */}
      <Breadcrumbs
        items={[{ href: '/jobs', label: 'Jobs' }, { label: 'Job Details' }]}
      />
      <div className="sticky top-16 z-10 flex gap-2 overflow-x-auto whitespace-nowrap bg-gray-50 py-2 no-scrollbar dark:bg-gray-950">
        {(
          [
            'overview',
            'finance',
            'docs',
            'tasks',
            'proposals',
            'activity',
          ] as const
        ).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setTab(t);
              const url = `${location.pathname}?tab=${t}`;
              window.history.replaceState(null, '', url);
            }}
            className="shrink-0"
          >
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <StageProgress status={job?.status} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <NextActionCard jobId={params.id} />
            <RequiredDocs jobId={params.id} status={job?.status} />
            <MilestoneTimeline job={job || {}} />
          </div>
          <Card title="Overview">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm">
              Customer:{' '}
              {(Array.isArray(job?.customers)
                ? job?.customers?.[0]?.name
                : (job as any)?.customers?.name) || '—'}
            </div>
            <div className="text-sm">
              System: {job?.system_type} • {job?.capacity_kw} kW
            </div>
            <div className="text-sm flex items-center gap-2">
              <span>Status:</span>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={job?.status}
                onChange={async (e) => {
                  const newStatus = e.target.value as JobStatus;
                  const ok = await confirm({
                    title: 'Change status',
                    description: `Change status to ${statusLabel(newStatus)}?`,
                  });
                  if (!ok) return;
                  const prev = job?.status as JobStatus | undefined;
                  const { data: session } = await supabase.auth.getSession();
                  const token = session.session?.access_token;
                  await fetch('/api/jobs/updateStatus', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ jobId: params.id, newStatus }),
                  });
                  // Auto-fill milestone date
                  const today = new Date().toISOString().slice(0, 10);
                  const patch: any = {};
                  if (newStatus === 'Quoted' && !job?.date_quote)
                    patch.date_quote = today;
                  if (newStatus === 'Won' && !job?.date_won)
                    patch.date_won = today;
                  if (newStatus === 'KSEB_Submitted' && !job?.date_kseb_submit)
                    patch.date_kseb_submit = today;
                  if (newStatus === 'Installed' && !job?.date_install)
                    patch.date_install = today;
                  if (newStatus === 'Net_Metered' && !job?.date_meter)
                    patch.date_meter = today;
                  if (newStatus === 'Handover' && !job?.date_handover)
                    patch.date_handover = today;
                  if (Object.keys(patch).length) {
                    await supabase
                      .from('jobs')
                      .update(patch)
                      .eq('id', params.id);
                  }
                  const { data: refreshed } = await supabase
                    .from('jobs')
                    .select('*, customers(name, phone, email)')
                    .eq('id', params.id)
                    .single();
                  setJob(refreshed as any);
                  toast({
                    title: `Status: ${statusLabel(newStatus)}`,
                    actionLabel: prev ? 'Undo' : undefined,
                    onAction: prev
                      ? async () => {
                          await fetch('/api/jobs/updateStatus', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {}),
                            },
                            body: JSON.stringify({
                              jobId: params.id,
                              newStatus: prev,
                            }),
                          });
                          const { data: again } = await supabase
                            .from('jobs')
                            .select('*, customers(name, phone, email)')
                            .eq('id', params.id)
                            .single();
                          setJob(again as any);
                        }
                      : undefined,
                  });
                }}
              >
                {JOB_STATUSES.map((s: JobStatus) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="text-gray-700">Location</div>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.location || ''}
                onChange={(e) => setEdit({ ...edit, location: e.target.value })}
              />
            </label>
            <label className="text-sm flex items-end gap-2">
              <input
                type="checkbox"
                className="mt-6 h-4 w-4"
                checked={!!edit?.is_loan}
                onChange={(e) => setEdit({ ...edit, is_loan: e.target.checked })}
              />
              <span className="mt-5">Loan scheme</span>
            </label>
            <label className="text-sm">
              <div className="text-gray-700">KSEB Application No</div>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.kseb_application_no || ''}
                onChange={(e) =>
                  setEdit({ ...edit, kseb_application_no: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Subsidy Portal Ref</div>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.subsidy_portal_ref || ''}
                onChange={(e) =>
                  setEdit({ ...edit, subsidy_portal_ref: e.target.value })
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="text-gray-700">Notes</div>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={3}
                value={edit?.notes || ''}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Site Survey Date</div>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.date_site_survey || ''}
                onChange={(e) =>
                  setEdit({ ...edit, date_site_survey: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">KSEB Submit Date</div>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.date_kseb_submit || ''}
                onChange={(e) =>
                  setEdit({ ...edit, date_kseb_submit: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Install Date</div>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.date_install || ''}
                onChange={(e) =>
                  setEdit({ ...edit, date_install: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Net Meter Date</div>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.date_meter || ''}
                onChange={(e) =>
                  setEdit({ ...edit, date_meter: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Handover Date</div>
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={edit?.date_handover || ''}
                onChange={(e) =>
                  setEdit({ ...edit, date_handover: e.target.value })
                }
              />
            </label>
          </div>
          <div className="mt-4">
              <Button
                onClick={async () => {
                  await supabase
                    .from('jobs')
                    .update({
                      location: edit.location || null,
                      kseb_application_no: edit.kseb_application_no || null,
                      subsidy_portal_ref: edit.subsidy_portal_ref || null,
                      notes: edit.notes || null,
                      date_site_survey: edit.date_site_survey || null,
                      date_kseb_submit: edit.date_kseb_submit || null,
                      date_install: edit.date_install || null,
                      date_meter: edit.date_meter || null,
                      date_handover: edit.date_handover || null,
                      is_loan: !!edit.is_loan,
                    })
                    .eq('id', params.id);
                  // reload
                  const { data } = await supabase
                    .from('jobs')
                    .select('*, customers(name, phone, email)')
                    .eq('id', params.id)
                    .single();
                  setJob(data as any);
                  toast({ title: 'Saved', variant: 'success' });
                }}
              >
                Save Changes
              </Button>
            </div>
          <div className="mt-6">
            <ServiceForJob jobId={params.id} />
          </div>
        </Card>
        </>
      )}

      {tab === 'finance' && <Finance jobId={params.id} />}
      {tab === 'docs' && <Docs jobId={params.id} />}
      {tab === 'tasks' && <Tasks jobId={params.id} />}
      {tab === 'proposals' && <Proposals jobId={params.id} />}
      {tab === 'activity' && <Activity jobId={params.id} />}
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={<div />}> 
      <JobDetailPageInner />
    </Suspense>
  );
}

function ServiceForJob({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>('');

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data: t } = await supabase
        .from('service_tickets')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: false });
      setRows(t || []);
      const { data: j } = await supabase
        .from('jobs')
        .select('customer_id')
        .eq('id', jobId)
        .single();
      setCustomerId((j as any)?.customer_id || '');
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const add = async () => {
    if (!summary.trim()) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const tenantId = (prof as any)?.tenant_id as string | undefined;
    if (!tenantId) {
      setErr('Profile not ready');
      return;
    }
    await supabase.from('service_tickets').insert({
      tenant_id: tenantId,
      customer_id: customerId || null,
      job_id: jobId,
      date: new Date().toISOString().slice(0, 10),
      summary: summary.trim(),
      status: 'Open',
      priority: 'Medium',
    });
    setSummary('');
    load();
  };

  return (
    <Card title="Service Tickets">
      {err && (
        <div className="mb-2 rounded border bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <input
          className="md:col-span-4 rounded border px-3 py-2"
          placeholder="Quick add summary…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Button onClick={add}>Add</Button>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {loading ? (
          <li className="text-gray-600">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="text-gray-600">No service tickets</li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded border bg-white p-3"
            >
              <span className="truncate">{r.summary || '—'}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{r.status}</span>
                <a className="text-blue-600" href={`/service/${r.id}`}>
                  Open
                </a>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function Finance({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [showInv, setShowInv] = useState(false);
  const [invAmt, setInvAmt] = useState<number>(0);
  const [invType, setInvType] = useState<'Deposit' | 'Progress' | 'Final'>(
    'Progress',
  );
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>('');
  const [payMode, setPayMode] = useState<
    'UPI' | 'NEFT' | 'Cash' | 'Card' | 'Cheque'
  >('UPI');
  const [payRef, setPayRef] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [upiId, setUpiId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  useEffect(() => {
    (async () => {
      const { data: inv, error: iErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', jobId);
      if (iErr) setErr(iErr.message);
      const { data: pay } = await supabase
        .from('payments')
        .select('*, invoices(total)')
        .in(
          'invoice_id',
          (inv || []).map((i) => i.id),
        );
      setInvoices(inv || []);
      setPayments(pay || []);
      // Fetch settings and tenant for UPI
      const { data: user } = await supabase.auth.getUser();
      const uid = (user?.user as any)?.id as string | undefined;
      const { data: prof } = uid
        ? await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', uid)
            .maybeSingle()
        : ({ data: null } as any);
      if (prof?.tenant_id) {
        const [{ data: setg }, { data: ten }] = await Promise.all([
          supabase
            .from('settings')
            .select('*')
            .eq('tenant_id', (prof as any).tenant_id)
            .maybeSingle(),
          supabase
            .from('tenants')
            .select('name')
            .eq('id', (prof as any).tenant_id)
            .maybeSingle(),
        ]);
        if ((setg as any)?.upi_id) setUpiId((setg as any).upi_id as string);
        if ((ten as any)?.name) setCompanyName((ten as any).name as string);
      }
    })();
  }, [jobId]);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {err && (
        <div className="md:col-span-2 rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card title="Invoices">
        <ul className="space-y-2 text-sm">
          {invoices.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span>
                {i.invoice_type} • Due {i.due_date || '—'}
              </span>
              <select
                className="rounded border px-2 py-1 text-xs"
                value={i.status || 'Draft'}
                onChange={async (e) => {
                  const newStatus = e.target.value as any;
                  await supabase
                    .from('invoices')
                    .update({ status: newStatus })
                    .eq('id', i.id);
                  // Audit: invoice status update
                  const { data: user } = await supabase.auth.getUser();
                  const uid = (user?.user as any)?.id as string | undefined;
                  const { data: prof } = uid
                    ? await supabase
                        .from('profiles')
                        .select('tenant_id')
                        .eq('user_id', uid)
                        .maybeSingle()
                    : ({ data: null } as any);
                  if (prof?.tenant_id) {
                    await supabase.from('audit_logs').insert({
                      tenant_id: (prof as any).tenant_id,
                      user_id: (user?.user as any)?.id || null,
                      action: 'invoices.update_status',
                      entity: 'jobs',
                      entity_id: jobId,
                      metadata: { invoiceId: i.id, newStatus },
                    });
                  }
                  const { data: inv } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('job_id', jobId);
                  setInvoices(inv || []);
                }}
              >
                {['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          ))}
          {invoices.length === 0 && (
            <li className="text-gray-500">No invoices</li>
          )}
        </ul>
        <div className="mt-3 space-y-2">
          <button
            className="text-blue-600 text-sm"
            onClick={() => setShowInv((v) => !v)}
          >
            {showInv ? 'Hide' : 'New Invoice'}
          </button>
          {showInv && (
            <div className="grid grid-cols-1 gap-2">
              <select
                className="rounded border px-2 py-1 text-sm"
                value={invType}
                onChange={(e) => setInvType(e.target.value as any)}
              >
                <option>Deposit</option>
                <option>Progress</option>
                <option>Final</option>
              </select>
              <input
                className="rounded border px-3 py-2"
                type="number"
                placeholder="Amount"
                value={invAmt}
                onChange={(e) => setInvAmt(Number(e.target.value))}
              />
              <button
                className="rounded bg-blue-600 px-3 py-2 text-white text-sm"
                onClick={async () => {
                  const { ensureProfileIfMissing } = await import('@/lib/ensureProfileClient');
                  const tenantId = await ensureProfileIfMissing(supabase as any);
                  if (!tenantId) {
                    alert('Profile not ready');
                    return;
                  }
                  const due = new Date();
                  due.setDate(due.getDate() + 7);
                  const { data: created } = await supabase
                    .from('invoices')
                    .insert({
                      tenant_id: tenantId,
                      job_id: jobId,
                      date: new Date().toISOString().slice(0, 10),
                      invoice_type: invType,
                      amount_before_tax: invAmt,
                      tax: 0,
                      total: invAmt,
                      due_date: due.toISOString().slice(0, 10),
                      status: 'Draft',
                    })
                    .select('id, total, invoice_type')
                    .single();
                  // Audit: invoice created
                  const { data: user } = await supabase.auth.getUser();
                  await supabase.from('audit_logs').insert({
                    tenant_id: tenantId,
                    user_id: (user?.user as any)?.id || null,
                    action: 'invoices.create',
                    entity: 'jobs',
                    entity_id: jobId,
                    metadata: {
                      invoiceId: (created as any)?.id,
                      total: (created as any)?.total,
                      type: (created as any)?.invoice_type,
                    },
                  });
                  const { data: inv } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('job_id', jobId);
                  setInvoices(inv || []);
                  setShowInv(false);
                  setInvAmt(0);
                }}
              >
                Create
              </button>
            </div>
          )}
        </div>
      </Card>
      <Card title="Payments">
        <ul className="space-y-2 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>{p.date}</span>
              <span>₹{p.amount}</span>
            </li>
          ))}
          {payments.length === 0 && (
            <li className="text-gray-500">No payments</li>
          )}
        </ul>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <input
            className="rounded border px-3 py-2"
            type="date"
            placeholder="Date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            type="number"
            placeholder="Amount"
            value={payAmt}
            onChange={(e) => setPayAmt(Number(e.target.value))}
          />
          <div className="flex items-center gap-2">
            <select
              className="rounded border px-2 py-2 text-sm"
              value={payMode}
              onChange={(e) => setPayMode(e.target.value as any)}
            >
              {['UPI', 'NEFT', 'Cash', 'Card', 'Cheque'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              className="rounded border px-3 py-2"
              placeholder="Reference"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>
          {payMode === 'UPI' && upiId && payAmt > 0 && (
            <div className="text-xs text-gray-600">
              <a
                className="text-blue-600"
                href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(companyName || 'Company')}&am=${encodeURIComponent(String(payAmt))}&cu=INR`}
              >
                Open UPI app to pay ₹{payAmt}
              </a>
            </div>
          )}
          <button
            className="rounded bg-blue-600 px-3 py-2 text-white text-sm"
            onClick={async () => {
              const { data: inv } = await supabase
                .from('invoices')
                .select('id')
                .eq('job_id', jobId)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!inv) return alert('Create an invoice first');
              const { ensureProfileIfMissing } = await import('@/lib/ensureProfileClient');
              const tenantId = await ensureProfileIfMissing(supabase as any);
              if (!tenantId) {
                alert('Profile not ready');
                return;
              }
              const { data: created } = await supabase
                .from('payments')
                .insert({
                  tenant_id: tenantId,
                  invoice_id: inv.id,
                  date: payDate || new Date().toISOString().slice(0, 10),
                  mode: payMode,
                  amount: payAmt,
                  reference: payRef || null,
                })
                .select('id, amount')
                .single();
              // Audit: payment recorded
              const { data: user } = await supabase.auth.getUser();
              await supabase.from('audit_logs').insert({
                tenant_id: tenantId,
                user_id: (user?.user as any)?.id || null,
                action: 'payments.create',
                entity: 'jobs',
                entity_id: jobId,
                metadata: {
                  paymentId: (created as any)?.id,
                  amount: (created as any)?.amount,
                },
              });
              const { data: pay } = await supabase
                .from('payments')
                .select('*, invoices(total)')
                .in('invoice_id', [inv.id]);
              setPayments(pay || []);
              setPayAmt(0);
              setPayDate('');
              setPayRef('');
            }}
          >
            Record Payment
          </button>
        </div>
      </Card>
    </div>
  );
}

function Activity({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<
    Record<string, { display_name?: string | null }>
  >({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity', 'jobs')
          .eq('entity_id', jobId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const list = (data as any[]) || [];
        setRows(list);
        const userIds = Array.from(
          new Set(list.map((r) => r.user_id).filter(Boolean)),
        );
        if (userIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds as string[]);
          const map: Record<string, { display_name?: string | null }> = {};
          for (const p of (profs as any[]) || [])
            map[p.user_id] = { display_name: p.display_name };
          setUsers(map);
        } else {
          setUsers({});
        }
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const who = (id?: string | null) =>
    id ? users[id!]?.display_name || id.slice(0, 8) : 'System';
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : '';
  const goTab = (t: string) => {
    const url = `${location.pathname}?tab=${t}`;
    window.history.replaceState(null, '', url);
    window.location.href = url;
  };
  const openProposalKey = async (key?: string | null) => {
    if (!key) return;
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(key, 60 * 60 * 24 * 7);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card title="Activity">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No activity yet</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => {
              let content: any = r.action || '—';
              let action: any = null;
              switch (r.action) {
                case 'jobs.update_status':
                  content = `Status changed to ${r.metadata?.newStatus || '—'}`;
                  break;
                case 'invoices.create':
                  content = `Invoice created (${r.metadata?.type || '—'}) • ₹${r.metadata?.total ?? '—'}`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('finance')}
                    >
                      Finance
                    </button>
                  );
                  break;
                case 'invoices.update_status':
                  content = `Invoice marked ${r.metadata?.newStatus || '—'}`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('finance')}
                    >
                      Finance
                    </button>
                  );
                  break;
                case 'payments.create':
                  content = `Payment recorded • ₹${r.metadata?.amount ?? '—'}`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('finance')}
                    >
                      Finance
                    </button>
                  );
                  break;
                case 'documents.upload':
                  content = `Document uploaded (${r.metadata?.docType || 'document'})`;
                  action = (
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-600"
                        onClick={() => goTab('docs')}
                      >
                        Docs
                      </button>
                      {r.metadata?.fileUrl && (
                        <a
                          className="text-xs text-gray-700"
                          href={r.metadata.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  );
                  break;
                case 'proposals.create':
                  content = `Proposal created • ₹${r.metadata?.total ?? '—'}`;
                  action = (
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-600"
                        onClick={() => goTab('proposals')}
                      >
                        Proposals
                      </button>
                      {r.metadata?.pdfKey && (
                        <button
                          className="text-xs text-gray-700"
                          onClick={() => openProposalKey(r.metadata.pdfKey)}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  );
                  break;
                case 'proposals.update_status':
                  content = `Proposal ${r.metadata?.status || 'Updated'}`;
                  action = (
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-600"
                        onClick={() => goTab('proposals')}
                      >
                        Proposals
                      </button>
                      {r.metadata?.pdfKey && (
                        <button
                          className="text-xs text-gray-700"
                          onClick={() => openProposalKey(r.metadata.pdfKey)}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  );
                  break;
                case 'proposals.whatsapp_send':
                  content = `Proposal sent via WhatsApp to ${r.metadata?.to || '—'}`;
                  action = (
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-600"
                        onClick={() => goTab('proposals')}
                      >
                        Proposals
                      </button>
                      {r.metadata?.pdfUrl ? (
                        <a
                          className="text-xs text-gray-700"
                          href={r.metadata.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : r.metadata?.pdfKey ? (
                        <button
                          className="text-xs text-gray-700"
                          onClick={() => openProposalKey(r.metadata.pdfKey)}
                        >
                          Open
                        </button>
                      ) : null}
                    </div>
                  );
                  break;
                case 'tasks.create':
                  content = `Task created: ${r.metadata?.title || '—'}`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('tasks')}
                    >
                      Tasks
                    </button>
                  );
                  break;
                case 'tasks.update':
                  content = `Task updated`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('tasks')}
                    >
                      Tasks
                    </button>
                  );
                  break;
                case 'tasks.delete':
                  content = `Task deleted: ${r.metadata?.title || '—'}`;
                  action = (
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => goTab('tasks')}
                    >
                      Tasks
                    </button>
                  );
                  break;
              }
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded border bg-white p-2"
                >
                  <span>{content}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-600">
                    {action}
                    <span>
                      {who(r.user_id)} • {fmt(r.created_at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Proposals({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<{
    name?: string;
    phone?: string;
  } | null>(null);
  const [capacity, setCapacity] = useState<number>(0);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: false });
      setRows(data || []);
    })();
  }, [jobId]);

  useEffect(() => {
    (async () => {
      const { data: job } = await supabase
        .from('jobs')
        .select('capacity_kw, customers(name, phone)')
        .eq('id', jobId)
        .single();
      setCustomer((job as any)?.customers?.[0] || null);
      setCapacity(Number(job?.capacity_kw || 0));
    })();
  }, [jobId]);

  const openPdf = async (key?: string | null) => {
    if (!key) return;
    if (!signed[key]) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(key, 60 * 60 * 24 * 7);
      if (data?.signedUrl) setSigned((s) => ({ ...s, [key]: data.signedUrl }));
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } else {
      window.open(signed[key], '_blank');
    }
  };

  const parseStatus = (terms?: string | null) => {
    if (!terms) return null;
    const m = /^\[STATUS:([^\]]+)\]/.exec(terms);
    return m ? m[1] : null;
  };

  const setStatus = async (
    id: string,
    status: 'Sent' | 'Accepted' | 'Rejected',
    jobUpdate?: 'Won',
  ) => {
    const row = rows.find((r) => r.id === id);
    const rest = String(row?.terms || '').replace(/^\[STATUS:[^\]]+\]\s*/, '');
    await supabase
      .from('proposals')
      .update({ terms: `[STATUS:${status}] ${rest}` })
      .eq('id', id);
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('job_id', jobId)
      .order('date', { ascending: false });
    setRows(data || []);
    // Audit: proposal status update
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = (user?.user as any)?.id as string | undefined;
      const { data: prof } = uid
        ? await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', uid)
            .maybeSingle()
        : ({ data: null } as any);
      if (prof?.tenant_id) {
        await supabase.from('audit_logs').insert({
          tenant_id: (prof as any).tenant_id,
          user_id: (user?.user as any)?.id || null,
          action: 'proposals.update_status',
          entity: 'jobs',
          entity_id: jobId,
          metadata: { proposalId: id, status, pdfKey: row?.pdf_url || null },
        });
      }
    } catch {}
    if (jobUpdate === 'Won') {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      await fetch('/api/jobs/updateStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId, newStatus: 'Won' }),
      });
    }
    toast({
      title: `Proposal marked ${status}`,
      description: jobUpdate ? 'Job updated too' : undefined,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Proposals</h3>
        <a
          className="rounded bg-blue-600 px-3 py-2 text-white"
          href={`/proposals/new?jobId=${jobId}`}
        >
          New Proposal
        </a>
      </div>
      {flash && (
        <div className="rounded border bg-emerald-50 p-2 text-xs text-emerald-700">
          {flash}
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded border bg-white p-3 text-sm flex items-center justify-between"
          >
            <span>
              {r.date || '—'} • {r.kit_name || '—'} • ₹{r.total ?? '—'}
              {parseStatus(r.terms) ? (
                <Badge
                  className="ml-2"
                  variant={
                    parseStatus(r.terms) === 'Accepted'
                      ? 'success'
                      : parseStatus(r.terms) === 'Rejected'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {parseStatus(r.terms)}
                </Badge>
              ) : null}
            </span>
            {r.pdf_url ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openPdf(r.pdf_url)}
                  className="text-blue-600"
                >
                  Open PDF
                </button>
                {customer?.phone && (
                  <button
                    className="text-emerald-600"
                    onClick={async () => {
                      if (!r.pdf_url) return;
                      let url = signed[r.pdf_url];
                      if (!url) {
                        const { data } = await supabase.storage
                          .from('documents')
                          .createSignedUrl(r.pdf_url, 60 * 60 * 24 * 7);
                        if (data?.signedUrl) {
                          url = data.signedUrl;
                          setSigned((s) => ({ ...s, [r.pdf_url]: url! }));
                        }
                      }
                      if (!url) return;
                      const { data: session } =
                        await supabase.auth.getSession();
                      const token = session.session?.access_token;
                      const res = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token
                            ? { Authorization: `Bearer ${token}` }
                            : {}),
                        },
                        body: JSON.stringify({
                          to: customer!.phone,
                          templateName: 'proposal_ready',
                          variables: [
                            customer!.name || 'Customer',
                            String(capacity || ''),
                            url,
                          ],
                        }),
                      });
                      if (!res.ok) throw new Error('WhatsApp send failed');
                      // Audit: proposal WhatsApp send
                      try {
                        const [{ data: prof }, { data: user }] =
                          await Promise.all([
                            supabase
                              .from('profiles')
                              .select('tenant_id')
                              .maybeSingle(),
                            supabase.auth.getUser(),
                          ]);
                        if (prof?.tenant_id) {
                          await supabase.from('audit_logs').insert({
                            tenant_id: (prof as any).tenant_id,
                            user_id: (user?.user as any)?.id || null,
                            action: 'proposals.whatsapp_send',
                            entity: 'jobs',
                            entity_id: jobId,
                            metadata: {
                              proposalId: r.id,
                              to: customer!.phone,
                              pdfUrl: url,
                            },
                          });
                        }
                      } catch {}
                      toast({
                        title: 'WhatsApp send enqueued',
                        variant: 'success',
                      });
                    }}
                  >
                    Send WhatsApp
                  </button>
                )}
                <button
                  className="text-gray-700"
                  onClick={() => setStatus(r.id, 'Sent')}
                >
                  Mark Sent
                </button>
                <button
                  className="text-emerald-700"
                  onClick={() => setStatus(r.id, 'Accepted', 'Won')}
                >
                  Mark Accepted
                </button>
                <button
                  className="text-red-700"
                  onClick={() => setStatus(r.id, 'Rejected')}
                >
                  Mark Rejected
                </button>
              </div>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Docs({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [docs, setDocs] = useState<any[]>([]);
  const [docSigned, setDocSigned] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('upload');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('job_id', jobId);
      setDocs(data || []);
    })();
  }, [jobId]);

  const upload = async () => {
    setMsg(null);
    if (!file) {
      setMsg('Select a file');
      return;
    }
    if (
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        file.type,
      )
    ) {
      setMsg('Only PDF or image files allowed');
      return;
    }
    setUploading(true);
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const tenantId2 = (prof as any)?.tenant_id as string | undefined;
    if (!tenantId2) {
      setMsg('Profile not ready');
      setUploading(false);
      return;
    }
    const key = `${tenantId2}/${crypto.randomUUID()}-${file.name}`;
    await supabase.storage.from('documents').upload(key, file);
    const { data: doc } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenantId2,
        job_id: jobId,
        // Store the storage key; sign when opening to avoid expired links
        file_url: key,
        doc_type: docType || 'upload',
      })
      .select('id, file_url, doc_type')
      .single();
    // Audit: document uploaded
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId2,
      user_id: (user?.user as any)?.id || null,
      action: 'documents.upload',
      entity: 'jobs',
      entity_id: jobId,
      metadata: {
        documentId: (doc as any)?.id,
        docType: (doc as any)?.doc_type,
        fileUrl: (doc as any)?.file_url,
      },
    });
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('job_id', jobId);
    setDocs(data || []);
    setFile(null);
    setUploading(false);
    setMsg('Uploaded');
    setTimeout(() => setMsg(null), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        {msg && (
          <div className="mb-2 rounded border bg-emerald-50 p-2 text-xs text-emerald-700">
            {msg}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            className="text-sm"
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <select
            className="rounded border px-2 py-1 text-sm"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="upload">Upload</option>
            <option value="kseb-application">KSEB Application</option>
            <option value="invoice">Invoice</option>
            <option value="photo">Photo</option>
          </select>
          <Button onClick={upload} loading={uploading}>
            Upload
          </Button>
        </div>
      </Card>
      <ul className="space-y-2">
        {docs.map((d) => {
          const stored: string = d.file_url || '';
          const looksLikeKey = stored && !/^https?:\/\//i.test(stored);
          return (
            <li
              key={d.id}
              className="rounded border bg-white p-3 text-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600">
                  File
                </div>
                <div>
                  <div className="text-gray-700">
                    {d.doc_type || 'document'}
                  </div>
                  <div
                    className="text-xs text-gray-500 truncate max-w-[240px]"
                    title={stored}
                  >
                    {stored}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="text-blue-600"
                  onClick={async () => {
                    try {
                      if (!looksLikeKey) {
                        window.open(stored, '_blank');
                        return;
                      }
                      const existing = docSigned[stored];
                      if (existing) {
                        window.open(existing, '_blank');
                        return;
                      }
                      const { data: s } = await supabase.storage
                        .from('documents')
                        .createSignedUrl(stored, 60 * 60 * 24 * 7);
                      if (s?.signedUrl) {
                        setDocSigned((m) => ({ ...m, [stored]: s.signedUrl }));
                        window.open(s.signedUrl, '_blank');
                      }
                    } catch {}
                  }}
                >
                  Open
                </button>
                <button
                  className="text-red-600"
                  onClick={async () => {
                    await supabase.from('documents').delete().eq('id', d.id);
                    const { data } = await supabase
                      .from('documents')
                      .select('*')
                      .eq('job_id', jobId);
                    setDocs(data || []);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
        {docs.length === 0 && (
          <li className="rounded border bg-white p-3 text-sm text-gray-600">
            No documents uploaded
          </li>
        )}
      </ul>
    </div>
  );
}

function Tasks({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, any>>({});
  const [myUserId, setMyUserId] = useState<string>('');

  // Add form state
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<
    'Low' | 'Medium' | 'High' | 'Urgent'
  >('Medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Filters / sorting
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Open' | 'InProgress' | 'Blocked' | 'Done'
  >('All');
  const [assigneeFilter, setAssigneeFilter] = useState<
    'All' | 'Me' | 'Unassigned' | string
  >('All');
  const [search, setSearch] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>({});

  const load = async () => {
    setErr(null);
    const { data: t } = await supabase
      .from('tasks')
      .select('*')
      .eq('job_id', jobId);
    setTasks(t || []);
  };

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        // Get my user id, then fetch my profile explicitly to avoid
        // maybeSingle() errors when multiple profiles exist in the tenant.
        const { data: user } = await supabase.auth.getUser();
        const uid = (user?.user as any)?.id || '';
        setMyUserId(uid);
        const { data: prof } = uid
          ? await supabase
              .from('profiles')
              .select('tenant_id')
              .eq('user_id', uid)
              .maybeSingle()
          : ({ data: null } as any);
        const tenantId = (prof as any)?.tenant_id;
        const [{ data: t }, { data: members }] = await Promise.all([
          supabase.from('tasks').select('*').eq('job_id', jobId),
          tenantId
            ? supabase
                .from('profiles')
                .select('user_id, display_name')
                .eq('tenant_id', tenantId)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        setTasks(t || []);
        const list = (members as any[]) || [];
        setTeam(list);
        const map: Record<string, any> = {};
        for (const m of list) map[m.user_id] = m;
        setMemberMap(map);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [jobId]);

  const audit = async (action: string, metadata: Record<string, any>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = (user?.user as any)?.id as string | undefined;
      const { data: prof } = uid
        ? await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', uid)
            .maybeSingle()
        : ({ data: null } as any);
      if ((prof as any)?.tenant_id) {
        await supabase.from('audit_logs').insert({
          tenant_id: (prof as any).tenant_id,
          user_id: (user?.user as any)?.id || null,
          action,
          entity: 'jobs',
          entity_id: jobId,
          metadata,
        });
      }
    } catch {}
  };

  const add = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    setAdding(true);
    setErr(null);
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = (user?.user as any)?.id as string | undefined;
      const { data: prof } = uid
        ? await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', uid)
            .maybeSingle()
        : ({ data: null } as any);
      const tenantId = (prof as any)?.tenant_id as string | undefined;
      if (!tenantId) {
        setErr('Profile not ready');
        setAdding(false);
        return;
      }
      const { data: created } = await supabase
        .from('tasks')
        .insert({
          tenant_id: tenantId,
          job_id: jobId,
          title: title.trim(),
          due_date: dueDate || null,
          priority,
          assigned_to: assignedTo || null,
          notes: notes || null,
          status: 'Open',
        })
        .select('id, title')
        .single();
      await audit('tasks.create', {
        taskId: (created as any)?.id,
        title: (created as any)?.title,
      });
      await load();
      setTitle('');
      setDueDate('');
      setPriority('Medium');
      setAssignedTo('');
      setNotes('');
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAdding(false);
    }
  };

  const updateTask = async (id: string, patch: Record<string, any>) => {
    setErr(null);
    await supabase.from('tasks').update(patch).eq('id', id);
    await audit('tasks.update', { taskId: id, patch });
    await load();
  };

  const removeTask = async (id: string) => {
    const ok = await confirm({
      title: 'Delete task',
      description: 'This cannot be undone',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    const t = tasks.find((x) => x.id === id);
    await supabase.from('tasks').delete().eq('id', id);
    await audit('tasks.delete', { taskId: id, title: t?.title });
    await load();
  };

  const prefill = async () => {
    try {
      setPrefilling(true);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/jobs/prefillTasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const m = await res.json().catch(() => ({}));
        throw new Error(m?.error || `HTTP ${res.status}`);
      }
      await load();
      toast({ title: 'Default tasks added', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Prefill failed', description: String(e?.message || e), variant: 'error' });
    } finally {
      setPrefilling(false);
    }
  };

  const statusOrder: Record<string, number> = {
    Open: 0,
    InProgress: 1,
    Blocked: 2,
    Done: 3,
  };
  const priorityOrder: Record<string, number> = {
    Urgent: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };
  const today = new Date().toISOString().slice(0, 10);

  const filtered = tasks
    .filter((t) => (statusFilter === 'All' ? true : t.status === statusFilter))
    .filter((t) => {
      if (assigneeFilter === 'All') return true;
      if (assigneeFilter === 'Unassigned') return !t.assigned_to;
      if (assigneeFilter === 'Me') return t.assigned_to === myUserId;
      return t.assigned_to === assigneeFilter;
    })
    .filter((t) =>
      search.trim()
        ? String(t.title || '')
            .toLowerCase()
            .includes(search.trim().toLowerCase()) ||
          String(t.notes || '')
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        : true,
    )
    .sort((a, b) => {
      // Status, then due date asc (nulls last), then priority
      const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (so !== 0) return so;
      const ad = a.due_date ? a.due_date : '9999-99-99';
      const bd = b.due_date ? b.due_date : '9999-99-99';
      if (ad !== bd) return ad < bd ? -1 : 1;
      const po =
        (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      if (po !== 0) return po;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

  const openCount = tasks.filter((t) => t.status !== 'Done').length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'Done' && t.due_date && t.due_date < today,
  ).length;

  return (
    <div className="space-y-4" id="tasks">
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <Card title="Add Task">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            className="md:col-span-2 rounded border px-3 py-2"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <select
            className="rounded border px-2 py-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
          >
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-2 text-sm"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.user_id}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <textarea
            className="md:col-span-4 rounded border px-3 py-2"
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={add} loading={adding}>
            Add
          </Button>
        </div>
      </Card>

      <Card
        title={`Tasks (${filtered.length})`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={prefill} loading={prefilling}>
              Prefill defaults
            </Button>
            <span className="hidden md:inline text-xs text-gray-600">
              Open: {openCount}
              {overdueCount ? ` • Overdue: ${overdueCount}` : ''}
            </span>
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              {['All', 'Open', 'InProgress', 'Blocked', 'Done'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as any)}
            >
              <option value="All">All</option>
              <option value="Me">Assigned to me</option>
              <option value="Unassigned">Unassigned</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.user_id}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ul className="space-y-2">
          {filtered.map((t) => {
            const overdue =
              t.status !== 'Done' && t.due_date && t.due_date < today;
            const dueSoon =
              t.status !== 'Done' &&
              t.due_date &&
              t.due_date >= today &&
              new Date(t.due_date).getTime() - new Date(today).getTime() <=
                2 * 24 * 60 * 60 * 1000;
            const isEditing = editingId === t.id;
            return (
              <li key={t.id} className="rounded border bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={t.status === 'Done'}
                      onChange={(e) =>
                        updateTask(t.id, {
                          status: e.target.checked ? 'Done' : 'Open',
                        })
                      }
                    />
                    <div>
                      {!isEditing ? (
                        <div
                          className={
                            'font-medium ' +
                            (t.status === 'Done'
                              ? 'line-through text-gray-500'
                              : '')
                          }
                        >
                          {t.title || '—'}
                        </div>
                      ) : (
                        <input
                          className="rounded border px-2 py-1 w-full"
                          value={edit.title ?? t.title ?? ''}
                          onChange={(e) =>
                            setEdit({ ...edit, title: e.target.value })
                          }
                        />
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-700">
                        <span
                          className={
                            'rounded-full px-2 py-0.5 border ' +
                            (t.priority === 'Urgent'
                              ? 'border-red-500 text-red-600'
                              : t.priority === 'High'
                                ? 'border-orange-500 text-orange-600'
                                : t.priority === 'Low'
                                  ? 'border-gray-400 text-gray-600'
                                  : 'border-blue-400 text-blue-600')
                          }
                        >
                          {t.priority || 'Medium'}
                        </span>
                        <span
                          className={
                            'rounded-full px-2 py-0.5 border ' +
                            (t.status === 'Blocked'
                              ? 'border-amber-500 text-amber-600'
                              : t.status === 'InProgress'
                                ? 'border-sky-500 text-sky-600'
                                : t.status === 'Done'
                                  ? 'border-emerald-500 text-emerald-600'
                                  : 'border-gray-400 text-gray-600')
                          }
                        >
                          {t.status || 'Open'}
                        </span>
                        <span
                          className={
                            'rounded-full px-2 py-0.5 border ' +
                            (overdue
                              ? 'border-red-500 text-red-600'
                              : dueSoon
                                ? 'border-orange-500 text-orange-600'
                                : 'border-gray-400 text-gray-600')
                          }
                        >
                          {t.due_date ? `Due ${t.due_date}` : 'No due date'}
                        </span>
                        <span className="rounded-full px-2 py-0.5 border border-gray-300">
                          {t.assigned_to
                            ? memberMap[t.assigned_to]?.display_name ||
                              t.assigned_to
                            : 'Unassigned'}
                        </span>
                      </div>
                      {t.notes && !isEditing && (
                        <div className="mt-2 text-gray-700">{t.notes}</div>
                      )}
                      {isEditing && (
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                          <input
                            className="rounded border px-2 py-1"
                            type="date"
                            value={edit.due_date ?? t.due_date ?? ''}
                            onChange={(e) =>
                              setEdit({ ...edit, due_date: e.target.value })
                            }
                          />
                          <select
                            className="rounded border px-2 py-1"
                            value={edit.priority ?? t.priority ?? 'Medium'}
                            onChange={(e) =>
                              setEdit({ ...edit, priority: e.target.value })
                            }
                          >
                            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                          <select
                            className="rounded border px-2 py-1"
                            value={edit.assigned_to ?? t.assigned_to ?? ''}
                            onChange={(e) =>
                              setEdit({ ...edit, assigned_to: e.target.value })
                            }
                          >
                            <option value="">Unassigned</option>
                            {team.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.display_name || m.user_id}
                              </option>
                            ))}
                          </select>
                          <select
                            className="rounded border px-2 py-1"
                            value={edit.status ?? t.status ?? 'Open'}
                            onChange={(e) =>
                              setEdit({ ...edit, status: e.target.value })
                            }
                          >
                            {['Open', 'InProgress', 'Blocked', 'Done'].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ),
                            )}
                          </select>
                          <textarea
                            className="md:col-span-4 rounded border px-2 py-1"
                            rows={2}
                            value={edit.notes ?? t.notes ?? ''}
                            onChange={(e) =>
                              setEdit({ ...edit, notes: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        {t.status !== 'InProgress' && t.status !== 'Done' && (
                          <button
                            className="text-xs text-blue-600"
                            onClick={() =>
                              updateTask(t.id, { status: 'InProgress' })
                            }
                          >
                            Start
                          </button>
                        )}
                        {t.status !== 'Blocked' && t.status !== 'Done' && (
                          <button
                            className="text-xs text-amber-600"
                            onClick={() =>
                              updateTask(t.id, { status: 'Blocked' })
                            }
                          >
                            Block
                          </button>
                        )}
                        {t.status === 'Done' && (
                          <button
                            className="text-xs text-gray-600"
                            onClick={() => updateTask(t.id, { status: 'Open' })}
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          className="text-xs text-gray-700"
                          onClick={() => {
                            setEditingId(t.id);
                            setEdit({});
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600"
                          onClick={() => removeTask(t.id)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="text-xs text-gray-700"
                          onClick={() => {
                            setEditingId(null);
                            setEdit({});
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="text-xs text-emerald-700"
                          onClick={async () => {
                            await updateTask(t.id, {
                              title: edit.title ?? t.title,
                              due_date: edit.due_date ?? t.due_date,
                              priority: edit.priority ?? t.priority,
                              assigned_to:
                                edit.assigned_to === ''
                                  ? null
                                  : (edit.assigned_to ?? t.assigned_to),
                              status: edit.status ?? t.status,
                              notes: edit.notes ?? t.notes,
                            });
                            setEditingId(null);
                            setEdit({});
                          }}
                        >
                          Save
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="rounded border bg-white p-3 text-sm text-gray-600">
              No matching tasks
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
