'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '~/components/Breadcrumbs';
import Card from '~/components/ui/Card';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import { useToast } from '~/components/ui/ToastProvider';

export default function ServiceTicketDetail() {
  const params = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const { data: t } = await supabase
          .from('service_tickets')
          .select('*, customers(id, name), jobs(id)')
          .eq('id', params.id)
          .single();
        setTicket(t as any);
        setEdit({
          summary: (t as any)?.summary || '',
          date: (t as any)?.date || new Date().toISOString().slice(0, 10),
          issue_type: (t as any)?.issue_type || '',
          priority: (t as any)?.priority || 'Medium',
          status: (t as any)?.status || 'Open',
          assigned_to: (t as any)?.assigned_to || '',
          resolution_notes: (t as any)?.resolution_notes || '',
          job_id: (t as any)?.job_id || '',
        });
        const custId = (t as any)?.customer_id;
        if (custId) {
          const { data: j } = await supabase
            .from('jobs')
            .select('id, status')
            .eq('customer_id', custId);
          setJobs((j as any[]) || []);
        } else {
          setJobs([]);
        }
        const { data: prof } = await supabase
          .from('profiles')
          .select('tenant_id')
          .maybeSingle();
        if ((prof as any)?.tenant_id) {
          const { data: members } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .eq('tenant_id', (prof as any).tenant_id);
          setTeam((members as any[]) || []);
        }
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [params.id, supabase]);

  const afterSave = async () => {
    const { data: t } = await supabase
      .from('service_tickets')
      .select('*, customers(id, name), jobs(id)')
      .eq('id', params.id)
      .single();
    setTicket(t as any);
    toast({ title: 'Saved', variant: 'success' });
  };

  const customerName = useMemo(() => {
    const c = (ticket as any)?.customers;
    if (Array.isArray(c)) return c[0]?.name || '—';
    return (ticket as any)?.customers?.name || '—';
  }, [ticket]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Service Ticket</h1>
        <a className="text-blue-600 text-sm" href="/service">
          Back
        </a>
      </div>
      <Breadcrumbs
        items={[{ href: '/service', label: 'Service' }, { label: 'Ticket' }]}
      />
      {/* toasts used for feedback too */}
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            <div className="text-gray-700">Customer</div>
            <div className="mt-1 text-sm">{customerName}</div>
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Date</div>
            <Input
              type="date"
              value={edit?.date || ''}
              onChange={(e) => setEdit({ ...edit, date: e.target.value })}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="text-gray-700">Summary</div>
            <Input
              value={edit?.summary || ''}
              onChange={(e) => setEdit({ ...edit, summary: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Issue Type</div>
            <Input
              placeholder="e.g. No generation, Inverter error"
              value={edit?.issue_type || ''}
              onChange={(e) => setEdit({ ...edit, issue_type: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Priority</div>
            <Select
              value={edit?.priority || 'Medium'}
              onChange={(e) => setEdit({ ...edit, priority: e.target.value })}
            >
              {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Status</div>
            <Select
              value={edit?.status || 'Open'}
              onChange={(e) => setEdit({ ...edit, status: e.target.value })}
            >
              {['Open', 'InProgress', 'Blocked', 'Done'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Assigned To</div>
            <Select
              value={edit?.assigned_to || ''}
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
            </Select>
          </label>
          <label className="text-sm">
            <div className="text-gray-700">Link Job</div>
            <Select
              value={edit?.job_id || ''}
              onChange={(e) => setEdit({ ...edit, job_id: e.target.value })}
            >
              <option value="">None</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id.slice(0, 8)} • {j.status}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm md:col-span-2">
            <div className="text-gray-700">Resolution Notes</div>
            <textarea
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2"
              value={edit?.resolution_notes || ''}
              onChange={(e) =>
                setEdit({ ...edit, resolution_notes: e.target.value })
              }
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            onClick={async () => {
              await supabase
                .from('service_tickets')
                .update({
                  summary: edit.summary || null,
                  date: edit.date || null,
                  issue_type: edit.issue_type || null,
                  priority: edit.priority || 'Medium',
                  status: edit.status || 'Open',
                  assigned_to: edit.assigned_to || null,
                  job_id: edit.job_id || null,
                  resolution_notes: edit.resolution_notes || null,
                })
                .eq('id', params.id);
              afterSave();
            }}
          >
            Save Changes
          </Button>
          {edit?.job_id && (
            <a
              className="rounded border px-3 py-2 text-sm"
              href={`/jobs/${edit.job_id}`}
            >
              Open Job
            </a>
          )}
          <button
            className="rounded border px-3 py-2 text-sm text-gray-700"
            onClick={async () => {
              await supabase
                .from('service_tickets')
                .update({ status: 'Done' })
                .eq('id', params.id);
              afterSave();
            }}
          >
            Mark Done
          </button>
          <button
            className="ml-auto text-red-600 text-sm"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete ticket',
                description: 'This cannot be undone',
                variant: 'danger',
                confirmText: 'Delete',
              });
              if (!ok) return;
              await supabase
                .from('service_tickets')
                .delete()
                .eq('id', params.id);
              window.location.href = '/service';
            }}
          >
            Delete
          </button>
        </div>
      </Card>
    </div>
  );
}
