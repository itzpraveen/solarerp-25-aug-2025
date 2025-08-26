"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { JOB_STATUSES, statusLabel, type JobStatus } from '@/lib/status';
import Spinner from '~/components/ui/Spinner';

type Job = {
  id: string;
  customer_id: string;
  tenant_id: string;
  status: JobStatus;
  capacity_kw: string | null;
  system_type: string;
  location: string | null;
  customers?: { name: string }[];
};

export default function PipelineBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = supabaseBrowser();

  const load = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setJobs([]);
        return;
      }
      // Fetch jobs first (avoid nested select dependency on FK introspection)
      const { data: jobsRaw, error: jErr } = await supabase
        .from('jobs')
        .select('id, tenant_id, customer_id, status, capacity_kw, system_type, location')
        .order('created_at', { ascending: false });
      if (jErr) throw jErr;

      const rows = (jobsRaw as Job[]) || [];
      const customerIds = Array.from(new Set(rows.map(r => r.customer_id).filter(Boolean)));
      if (customerIds.length === 0) {
        setJobs(rows);
        return;
      }
      const { data: custs, error: cErr } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds as string[]);
      if (cErr) throw cErr;
      const nameById = new Map<string, string>();
      for (const c of (custs as any[]) || []) nameById.set(c.id, c.name || '—');
      const withNames = rows.map(r => ({
        ...r,
        customers: [{ name: nameById.get(r.customer_id) || '—' }],
      })) as Job[];
      setJobs(withNames);
    } catch (_e) {
      // Silent fail to keep UI usable; could add toast if desired
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = async (jobId: string, newStatus: JobStatus) => {
    if (!confirm(`Move job to "${statusLabel(newStatus)}"?`)) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    await fetch('/api/jobs/updateStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jobId, newStatus }),
    });
    load();
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {JOB_STATUSES.map((col: JobStatus) => (
        <div
          key={col}
          className="rounded-lg border bg-white shadow-sm"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
          const jobId = e.dataTransfer.getData('text/plain');
          onDrop(jobId, col);
        }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-gray-50/80 px-3 py-2 text-sm font-medium backdrop-blur">
            <span>{statusLabel(col)}</span>
            <span className="text-xs text-gray-500">{jobs.filter((j) => j.status === col).length}</span>
          </div>
          <div className="space-y-2 p-2 min-h-[260px]">
            {loading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                <Spinner />
                <span className="ml-2">Loading…</span>
              </div>
            )}
            {jobs
              .filter((j) => j.status === col)
              .map((j) => (
                <div
                  key={j.id}
                  className="cursor-move rounded border p-2 shadow-sm hover:shadow"
                  draggable
                  onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', j.id);
                  }}
                >
                  <div className="text-sm font-semibold">{j.customers?.[0]?.name || '—'}</div>
                  <div className="text-xs text-gray-600">{j.system_type} • {j.capacity_kw ?? '—'} kW</div>
                  <a className="mt-1 inline-block text-xs text-blue-600" href={`/jobs/${j.id}`}>
                    Open
                  </a>
                </div>
              ))}
            {!loading && jobs.filter((j) => j.status === col).length === 0 && (
              <div className="rounded border border-dashed p-3 text-center text-xs text-gray-500">No cards</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
