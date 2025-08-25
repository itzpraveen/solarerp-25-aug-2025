"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Breadcrumbs from '~/components/Breadcrumbs';
import Button from '~/components/ui/Button';
import { JOB_STATUSES, statusLabel } from '@/lib/status';

type Job = any;

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const [job, setJob] = useState<Job | null>(null);
  const [tab, setTab] = useState<'overview' | 'finance' | 'docs' | 'tasks' | 'proposals'>('overview');
  const [edit, setEdit] = useState<any | null>(null);

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
      });
    })();
  }, [params.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Job Details</h1>
        <button onClick={() => { if (history.length > 1) history.back(); else window.location.href = '/jobs'; }} className="text-sm text-blue-600">Back</button>
      </div>
      <Breadcrumbs items={[{ href: '/jobs', label: 'Jobs' }, { label: 'Job Details' }]} />
      <div className="flex flex-wrap gap-2">
        {(['overview', 'finance', 'docs', 'tasks', 'proposals'] as const).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'outline'} size="sm" onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card title="Overview">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm">Customer: {job?.customers?.name}</div>
            <div className="text-sm">System: {job?.system_type} • {job?.capacity_kw} kW</div>
            <div className="text-sm flex items-center gap-2">
              <span>Status:</span>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={job?.status}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  if (!confirm(`Change status to ${newStatus}?`)) return;
                  const { data: session } = await supabase.auth.getSession();
                  const token = session.session?.access_token;
                  await fetch('/api/jobs/updateStatus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ jobId: params.id, newStatus }),
                  });
                  // Auto-fill milestone date
                  const today = new Date().toISOString().slice(0,10);
                  const patch: any = {};
                  if (newStatus === 'Quoted' && !job?.date_quote) patch.date_quote = today;
                  if (newStatus === 'Won' && !job?.date_won) patch.date_won = today;
                  if (newStatus === 'KSEB_Submitted' && !job?.date_kseb_submit) patch.date_kseb_submit = today;
                  if (newStatus === 'Installed' && !job?.date_install) patch.date_install = today;
                  if (newStatus === 'Net_Metered' && !job?.date_meter) patch.date_meter = today;
                  if (newStatus === 'Handover' && !job?.date_handover) patch.date_handover = today;
                  if (Object.keys(patch).length) {
                    await supabase.from('jobs').update(patch).eq('id', params.id);
                  }
                  const { data: refreshed } = await supabase
                    .from('jobs')
                    .select('*, customers(name, phone, email)')
                    .eq('id', params.id)
                    .single();
                  setJob(refreshed as any);
                }}
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>{statusLabel(s as any)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="text-gray-700">Location</div>
              <input className="mt-1 w-full rounded border px-3 py-2" value={edit?.location || ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">KSEB Application No</div>
              <input className="mt-1 w-full rounded border px-3 py-2" value={edit?.kseb_application_no || ''} onChange={(e) => setEdit({ ...edit, kseb_application_no: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Subsidy Portal Ref</div>
              <input className="mt-1 w-full rounded border px-3 py-2" value={edit?.subsidy_portal_ref || ''} onChange={(e) => setEdit({ ...edit, subsidy_portal_ref: e.target.value })} />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="text-gray-700">Notes</div>
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={edit?.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Site Survey Date</div>
              <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={edit?.date_site_survey || ''} onChange={(e) => setEdit({ ...edit, date_site_survey: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">KSEB Submit Date</div>
              <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={edit?.date_kseb_submit || ''} onChange={(e) => setEdit({ ...edit, date_kseb_submit: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Install Date</div>
              <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={edit?.date_install || ''} onChange={(e) => setEdit({ ...edit, date_install: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Net Meter Date</div>
              <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={edit?.date_meter || ''} onChange={(e) => setEdit({ ...edit, date_meter: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="text-gray-700">Handover Date</div>
              <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={edit?.date_handover || ''} onChange={(e) => setEdit({ ...edit, date_handover: e.target.value })} />
            </label>
          </div>
          <div className="mt-4">
            <Button onClick={async () => {
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
                })
                .eq('id', params.id);
              // reload
              const { data } = await supabase
                .from('jobs')
                .select('*, customers(name, phone, email)')
                .eq('id', params.id)
                .single();
              setJob(data as any);
              alert('Saved');
            }}>Save Changes</Button>
          </div>
        </Card>
      )}

      {tab === 'finance' && <Finance jobId={params.id} />}
      {tab === 'docs' && <Docs jobId={params.id} />}
      {tab === 'tasks' && <Tasks jobId={params.id} />}
      {tab === 'proposals' && <Proposals jobId={params.id} />}
    </div>
  );
}

function Finance({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [showInv, setShowInv] = useState(false);
  const [invAmt, setInvAmt] = useState<number>(0);
  const [invType, setInvType] = useState<'Deposit' | 'Progress' | 'Final'>('Progress');
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: inv, error: iErr } = await supabase.from('invoices').select('*').eq('job_id', jobId);
      if (iErr) setErr(iErr.message);
      const { data: pay } = await supabase.from('payments').select('*, invoices(total)').in('invoice_id', (inv || []).map(i => i.id));
      setInvoices(inv || []);
      setPayments(pay || []);
    })();
  }, [jobId]);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {err && <div className="md:col-span-2 rounded border bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <Card title="Invoices">
        <ul className="space-y-2 text-sm">
          {invoices.map((i) => (
            <li key={i.id} className="flex items-center justify-between"><span>{i.invoice_type} • Due {i.due_date || '—'}</span><span>{i.status}</span></li>
          ))}
          {invoices.length === 0 && <li className="text-gray-500">No invoices</li>}
        </ul>
        <div className="mt-3 space-y-2">
          <button className="text-blue-600 text-sm" onClick={() => setShowInv((v) => !v)}>{showInv ? 'Hide' : 'New Invoice'}</button>
          {showInv && (
            <div className="grid grid-cols-1 gap-2">
              <select className="rounded border px-2 py-1 text-sm" value={invType} onChange={(e) => setInvType(e.target.value as any)}>
                <option>Deposit</option>
                <option>Progress</option>
                <option>Final</option>
              </select>
              <input className="rounded border px-3 py-2" type="number" placeholder="Amount" value={invAmt} onChange={(e) => setInvAmt(Number(e.target.value))} />
              <button className="rounded bg-blue-600 px-3 py-2 text-white text-sm" onClick={async () => {
                const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
                const due = new Date(); due.setDate(due.getDate() + 7);
                await supabase.from('invoices').insert({ tenant_id: prof!.tenant_id, job_id: jobId, date: new Date().toISOString().slice(0,10), invoice_type: invType, amount_before_tax: invAmt, tax: 0, total: invAmt, due_date: due.toISOString().slice(0,10), status: 'Draft' });
                const { data: inv } = await supabase.from('invoices').select('*').eq('job_id', jobId);
                setInvoices(inv || []);
                setShowInv(false); setInvAmt(0);
              }}>Create</button>
            </div>
          )}
        </div>
      </Card>
      <Card title="Payments">
        <ul className="space-y-2 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between"><span>{p.date}</span><span>₹{p.amount}</span></li>
          ))}
          {payments.length === 0 && <li className="text-gray-500">No payments</li>}
        </ul>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <input className="rounded border px-3 py-2" type="date" placeholder="Date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          <input className="rounded border px-3 py-2" type="number" placeholder="Amount" value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} />
          <button className="rounded bg-blue-600 px-3 py-2 text-white text-sm" onClick={async () => {
            const { data: inv } = await supabase.from('invoices').select('id').eq('job_id', jobId).order('date', { ascending: false }).limit(1).maybeSingle();
            if (!inv) return alert('Create an invoice first');
            const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
            await supabase.from('payments').insert({ tenant_id: prof!.tenant_id, invoice_id: inv.id, date: (payDate || new Date().toISOString().slice(0,10)), mode: 'UPI', amount: payAmt });
            const { data: pay } = await supabase.from('payments').select('*, invoices(total)').in('invoice_id', [inv.id]);
            setPayments(pay || []);
            setPayAmt(0); setPayDate('');
          }}>Record Payment</button>
        </div>
      </Card>
    </div>
  );
}

function Proposals({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<{ name?: string; phone?: string } | null>(null);
  const [capacity, setCapacity] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('job_id', jobId)
        .order('"date"', { ascending: false });
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
      const { data } = await supabase.storage.from('documents').createSignedUrl(key, 60 * 60 * 24 * 7);
      if (data?.signedUrl) setSigned((s) => ({ ...s, [key]: data.signedUrl }));
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } else {
      window.open(signed[key], '_blank');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Proposals</h3>
        <a className="rounded bg-blue-600 px-3 py-2 text-white" href={`/proposals/new?jobId=${jobId}`}>New Proposal</a>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
            <span>{r.date || '—'} • {r.kit_name || '—'} • ₹{r.total ?? '—'}</span>
            {r.pdf_url ? (
              <div className="flex items-center gap-3">
                <button onClick={() => openPdf(r.pdf_url)} className="text-blue-600">Open PDF</button>
                {customer?.phone && (
                  <button
                    className="text-emerald-600"
                    onClick={async () => {
                      if (!r.pdf_url) return;
                      let url = signed[r.pdf_url];
                      if (!url) {
                        const { data } = await supabase.storage.from('documents').createSignedUrl(r.pdf_url, 60 * 60 * 24 * 7);
                        if (data?.signedUrl) {
                          url = data.signedUrl;
                          setSigned((s) => ({ ...s, [r.pdf_url]: url! }));
                        }
                      }
                      if (!url) return;
                      const { data: session } = await supabase.auth.getSession();
                      const token = session.session?.access_token;
                      await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({
                          to: customer!.phone,
                          templateName: 'proposal_ready',
                          variables: [customer!.name || 'Customer', String(capacity || ''), url],
                        }),
                      });
                      alert('WhatsApp send enqueued.');
                    }}
                  >
                    Send WhatsApp
                  </button>
                )}
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
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('upload');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('documents').select('*').eq('job_id', jobId);
      setDocs(data || []);
    })();
  }, [jobId]);

  const upload = async () => {
    if (!file) return;
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Only PDF or image files allowed'); return;
    }
    setUploading(true);
    const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
    const key = `${prof!.tenant_id}/${crypto.randomUUID()}-${file.name}`;
    await supabase.storage.from('documents').upload(key, file);
    const { data: signed } = await supabase.storage.from('documents').createSignedUrl(key, 60 * 60 * 24 * 7);
    await supabase.from('documents').insert({ tenant_id: prof!.tenant_id, job_id: jobId, file_url: signed!.signedUrl, doc_type: docType || 'upload' });
    const { data } = await supabase.from('documents').select('*').eq('job_id', jobId);
    setDocs(data || []);
    setFile(null);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <input className="text-sm" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <select className="rounded border px-2 py-1 text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="upload">Upload</option>
            <option value="kseb-application">KSEB Application</option>
            <option value="invoice">Invoice</option>
            <option value="photo">Photo</option>
          </select>
          <Button onClick={upload} loading={uploading}>Upload</Button>
        </div>
      </Card>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="rounded border bg-white p-3 text-sm"><a className="text-blue-600" href={d.file_url} target="_blank">Open document</a></li>
        ))}
        {docs.length === 0 && <li className="rounded border bg-white p-3 text-sm text-gray-600">No documents uploaded</li>}
      </ul>
    </div>
  );
}

function Tasks({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tasks').select('*').eq('job_id', jobId);
      setTasks(data || []);
    })();
  }, [jobId]);
  const add = async () => {
    const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
    await supabase.from('tasks').insert({ tenant_id: prof!.tenant_id, job_id: jobId, title });
    const { data } = await supabase.from('tasks').select('*').eq('job_id', jobId);
    setTasks(data || []);
    setTitle('');
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-2">
          <input className="w-full rounded border px-3 py-2" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="rounded border bg-white p-3 text-sm">{t.title}</li>
        ))}
        {tasks.length === 0 && <li className="rounded border bg-white p-3 text-sm text-gray-600">No tasks</li>}
      </ul>
    </div>
  );
}
