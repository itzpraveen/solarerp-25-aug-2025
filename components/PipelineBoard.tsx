'use client';
import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { JOB_STATUSES, statusLabel, type JobStatus } from '@/lib/status';
import Skeleton from '~/components/ui/Skeleton';
import Input from '~/components/ui/Input';
import Segmented from '~/components/ui/Segmented';
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
  customers?: { name: string; phone?: string | null }[];
};

const CARD_LIMIT = 6;

// Memoized JobCard component to prevent unnecessary re-renders
const JobCard = memo(function JobCard({
  job,
  taskCount,
  cardPadding,
  titleClass,
  metaClass,
  actionClass,
  actionMargin,
  selectClass,
  taskBadgeClass,
  onStatusChange,
}: {
  job: Job;
  taskCount?: { open: number; total: number };
  cardPadding: string;
  titleClass: string;
  metaClass: string;
  actionClass: string;
  actionMargin: string;
  selectClass: string;
  taskBadgeClass: string;
  onStatusChange: (jobId: string, newStatus: JobStatus) => void;
}) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', job.id);
    },
    [job.id]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as JobStatus;
      onStatusChange(job.id, next);
    },
    [job.id, onStatusChange]
  );

  const customerName = job.customers?.[0]?.name || '—';
  const customerPhone = job.customers?.[0]?.phone;

  return (
    <div
      className={`cursor-move rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] ${cardPadding}`}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate font-semibold ${titleClass}`}>
            {customerName}
          </div>
          <div className={`text-[var(--text-secondary)] ${metaClass}`}>
            {job.system_type} • {job.capacity_kw ?? '—'} kW
          </div>
        </div>
        {taskCount && (
          <span
            className={`shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] ${taskBadgeClass}`}
            title="Open tasks / Total"
          >
            {taskCount.open}/{taskCount.total}
          </span>
        )}
      </div>
      <div className={`${actionMargin} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2">
          <a
            className={`inline-block text-[var(--primary-600)] dark:text-[var(--primary-600)] ${actionClass}`}
            href={`/jobs/${job.id}`}
          >
            Open
          </a>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className={`inline-block text-[var(--text-secondary)] ${actionClass}`}
              title="Call customer"
            >
              Call
            </a>
          )}
        </div>
        <select
          aria-label="Change status"
          className={`rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1 py-0.5 text-[var(--text-primary)] ${selectClass}`}
          value={job.status}
          onChange={handleStatusChange}
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default function PipelineBoard({
  branchId,
  showToolbar = true,
}: { branchId?: string | null; showToolbar?: boolean } = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState<JobStatus | 'all'>('all');
  const [expandedCols, setExpandedCols] = useState<Record<JobStatus, boolean>>(
    {} as Record<JobStatus, boolean>,
  );
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    'comfortable',
  );
  const [taskCounts, setTaskCounts] = useState<Record<string, { open: number; total: number }>>({});
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pref:jobs:pipelineDensity');
      if (saved === 'compact' || saved === 'comfortable') setDensity(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pref:jobs:pipelineDensity', density);
    } catch {}
  }, [density]);

  const load = useCallback(async () => {
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
        .select('id, name, phone')
        .in('id', customerIds as string[]);
      if (cErr) throw cErr;
      const nameById = new Map<string, string>();
      const phoneById = new Map<string, string | null>();
      for (const c of (custs as any[]) || []) {
        nameById.set(c.id, c.name || '—');
        phoneById.set(c.id, (c as any)?.phone || null);
      }
      const withNames = rows.map((r) => ({
        ...r,
        customers: [{ name: nameById.get(r.customer_id) || '—', phone: phoneById.get(r.customer_id) || null } as any],
      })) as Job[];
      setJobs(withNames);

      // Fetch task counts for these jobs (open vs total)
      try {
        const jobIds = withNames.map((r) => r.id);
        if (jobIds.length) {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('job_id, status')
            .in('job_id', jobIds as string[]);
          const counts: Record<string, { open: number; total: number }> = {};
          for (const t of ((tasks as any[]) || [])) {
            const k = (t as any).job_id as string;
            if (!counts[k]) counts[k] = { open: 0, total: 0 };
            counts[k].total += 1;
            if ((t as any).status !== 'Done') counts[k].open += 1;
          }
          setTaskCounts(counts);
        } else {
          setTaskCounts({});
        }
      } catch {}
    } catch (_e) {
      // Silent fail to keep UI usable; could add toast if desired
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

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
  }, [load, supabase]);

  const onDrop = useCallback(async (jobId: string, newStatus: JobStatus) => {
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
  }, [confirm, supabase, jobs, load, toast]);

  // Memoized status change handler for JobCard
  const handleCardStatusChange = useCallback(async (jobId: string, newStatus: JobStatus) => {
    const ok = await confirm({
      title: 'Move job',
      description: `Move job to "${statusLabel(newStatus)}"?`,
    });
    if (!ok) return;
    onDrop(jobId, newStatus);
  }, [confirm, onDrop]);

  const filteredJobs = useMemo(() => {
    const lc = term.trim().toLowerCase();
    if (!lc) return jobs;
    return jobs.filter((j) => {
      const name = j.customers?.[0]?.name || '';
      const loc = j.location || '';
      return (
        name.toLowerCase().includes(lc) ||
        loc.toLowerCase().includes(lc)
      );
    });
  }, [jobs, term]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<JobStatus, number>;
    for (const s of JOB_STATUSES) counts[s] = 0;
    for (const j of filteredJobs) counts[j.status] += 1;
    return counts;
  }, [filteredJobs]);

  const visibleStatuses =
    activeStatus === 'all' ? JOB_STATUSES : [activeStatus];
  const isCompact = density === 'compact';
  const listSpacing = isCompact ? 'space-y-1.5' : 'space-y-2';
  const listPadding = isCompact ? 'p-2' : 'p-2.5';
  const cardPadding = isCompact ? 'p-2' : 'p-2.5';
  const titleClass = isCompact ? 'text-[13px]' : 'text-sm';
  const metaClass = isCompact ? 'text-[11px]' : 'text-xs';
  const actionClass = isCompact ? 'text-[11px]' : 'text-xs';
  const actionMargin = isCompact ? 'mt-1.5' : 'mt-2';
  const selectClass = isCompact ? 'text-[10px]' : 'text-[11px]';
  const taskBadgeClass = isCompact
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-[10px]';
  const listMaxHeight = showToolbar
    ? 'calc(100vh - 320px)'
    : 'calc(100vh - 240px)';

  return (
    <div className="overflow-x-auto no-scrollbar">
      {showToolbar && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 px-2 py-1 text-sm w-full sm:w-64"
              placeholder="Search by customer or location"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)] shadow-sm transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
              onClick={() => setTerm('')}
            >
              Clear
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {term
                ? `Showing ${filteredJobs.length} of ${jobs.length}`
                : `${jobs.length} jobs`}
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-xs text-[var(--text-muted)]">Density</span>
              <Segmented
                value={density}
                onChange={setDensity}
                options={[
                  { label: 'Comfort', value: 'comfortable' },
                  { label: 'Compact', value: 'compact' },
                ]}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveStatus('all')}
              className={
                'rounded-full border px-3 py-1 transition-colors ' +
                (activeStatus === 'all'
                  ? 'border-[var(--primary-500)] bg-[var(--primary-100)] text-[var(--primary-700)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]')
              }
            >
              All ({filteredJobs.length})
            </button>
            {JOB_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveStatus(s)}
                className={
                  'rounded-full border px-3 py-1 transition-colors ' +
                  (activeStatus === s
                    ? 'border-[var(--primary-500)] bg-[var(--primary-100)] text-[var(--primary-700)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]')
                }
              >
                {statusLabel(s)} ({statusCounts[s]})
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className={
          'grid gap-4 snap-x snap-mandatory pb-2 ' +
          (activeStatus === 'all'
            ? 'min-w-[900px] grid-cols-[repeat(5,280px)] md:grid-cols-3 md:[grid-auto-columns:unset] md:[grid-template-columns:repeat(3,minmax(0,1fr))] lg:grid-cols-5'
            : 'min-w-[280px] grid-cols-1')
        }
      >
        {visibleStatuses.map((col: JobStatus) => {
          const colJobs = filteredJobs.filter((j) => j.status === col);
          const isExpanded = expandedCols[col] || false;
          const visibleJobs = isExpanded
            ? colJobs
            : colJobs.slice(0, CARD_LIMIT);
          return (
            <div
              key={col}
              className="snap-start rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const jobId = e.dataTransfer.getData('text/plain');
                onDrop(jobId, col);
              }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-medium">
                <span>{statusLabel(col)}</span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {colJobs.length}
                </span>
              </div>
              <div
                className={`${listSpacing} ${listPadding} min-h-[260px] overflow-y-auto`}
                style={{ maxHeight: listMaxHeight }}
              >
                {loading && (
                  <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                )}
                {visibleJobs.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    taskCount={taskCounts[j.id]}
                    cardPadding={cardPadding}
                    titleClass={titleClass}
                    metaClass={metaClass}
                    actionClass={actionClass}
                    actionMargin={actionMargin}
                    selectClass={selectClass}
                    taskBadgeClass={taskBadgeClass}
                    onStatusChange={handleCardStatusChange}
                  />
                ))}
                {!loading && colJobs.length === 0 && (
                  <div className="rounded border border-dashed border-[var(--border-default)] p-3 text-center text-xs text-[var(--text-muted)]">
                    {term ? 'No matches' : 'No cards'}
                  </div>
                )}
                {!loading && colJobs.length > CARD_LIMIT && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCols((prev) => ({
                        ...prev,
                        [col]: !prev[col],
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                  >
                    {isExpanded
                      ? 'Show less'
                      : `Show ${colJobs.length - CARD_LIMIT} more`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
