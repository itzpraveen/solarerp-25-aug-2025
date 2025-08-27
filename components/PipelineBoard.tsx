'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { JOB_STATUSES, statusLabel, type JobStatus } from '@/lib/status';
import Spinner from '~/components/ui/Spinner';
import Skeleton from '~/components/ui/Skeleton';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import { useToast } from '~/components/ui/ToastProvider';

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

export default function PipelineBoard({
  branchId,
}: { branchId?: string | null } = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setJobs([]);
        return;
      }
      // Fetch jobs first (avoid nested select dependency on FK introspection)
      let q = supabase
        .from('jobs')
        .select(
          'id, tenant_id, customer_id, status, capacity_kw, system_type, location, branch_id',
        )
        .order('created_at', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      const { data: jobsRaw, error: jErr } = await q;
      if (jErr) throw jErr;

      const rows = (jobsRaw as Job[]) || [];
      const customerIds = Array.from(
        new Set(rows.map((r) => r.customer_id).filter(Boolean)),
      );
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
      const withNames = rows.map((r) => ({
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

  // Realtime refresh on jobs changes
  useEffect(() => {
    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          // Keep it simple: reload on any change
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

  const onDrop = async (jobId: string, newStatus: JobStatus) => {
    const ok = await confirm({
      title: 'Move job',
      description: `Move job to "${statusLabel(newStatus)}"?`,
    });
    if (!ok) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const prev = jobs.find((j) => j.id === jobId)?.status;
    await fetch('/api/jobs/updateStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jobId, newStatus }),
    });
    load();
    if (prev) {
      toast({
        title: `Moved to ${statusLabel(newStatus)}`,
        actionLabel: 'Undo',
        onAction: async () => {
          await fetch('/api/jobs/updateStatus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ jobId, newStatus: prev }),
          });
          load();
        },
      });
    } else {
      toast({ title: `Moved to ${statusLabel(newStatus)}` });
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {JOB_STATUSES.map((col: JobStatus) => (
          <div
            key={col}
            className="rounded-lg border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const jobId = e.dataTransfer.getData('text/plain');
              onDrop(jobId, col);
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-gray-50/80 px-3 py-2 text-sm font-medium backdrop-blur dark:border-gray-800 dark:bg-gray-800/50">
              <span>{statusLabel(col)}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {jobs.filter((j) => j.status === col).length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[260px]">
              {loading && (
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              )}
              {jobs
                .filter((j) => j.status === col)
                .map((j) => (
                  <div
                    key={j.id}
                    className="cursor-move rounded border p-2 shadow-sm hover:shadow dark:border-gray-800 dark:bg-gray-950/40"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', j.id);
                    }}
                  >
                    <div className="text-sm font-semibold">
                      {j.customers?.[0]?.name || '—'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {j.system_type} • {j.capacity_kw ?? '—'} kW
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <a
                        className="inline-block text-xs text-blue-600 dark:text-blue-400"
                        href={`/jobs/${j.id}`}
                      >
                        Open
                      </a>
                      {/* Accessible status change */}
                      <select
                        aria-label="Change status"
                        className="rounded border px-1 py-0.5 text-[11px] dark:border-gray-800"
                        value={j.status}
                        onChange={async (e) => {
                          const next = e.target.value as JobStatus;
                          const ok = await confirm({
                            title: 'Move job',
                            description: `Move job to "${statusLabel(next)}"?`,
                          });
                          if (!ok) return;
                          onDrop(j.id, next);
                        }}
                      >
                        {JOB_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              {!loading &&
                jobs.filter((j) => j.status === col).length === 0 && (
                  <div className="rounded border border-dashed p-3 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    No cards
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
