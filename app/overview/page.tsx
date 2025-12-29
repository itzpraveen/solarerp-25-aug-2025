'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import QuickContact from 'components/QuickContact';
import Button from '~/components/ui/Button';
import BranchSelect from '~/components/BranchSelect';
import { JOB_STATUSES, statusLabel } from '@/lib/status';

export default function OverviewPage() {
  const supabase = supabaseBrowser();
  const [branchId, setBranchId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [leadsDue, setLeadsDue] = useState<any[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [recentProposals, setRecentProposals] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [paymentInvoiceJobMap, setPaymentInvoiceJobMap] = useState<
    Record<string, string>
  >({});
  const [leadSummary, setLeadSummary] = useState<{
    total: number;
    open: number;
    dueToday: number;
    overdue: number;
  } | null>(null);
  const [salesKpis, setSalesKpis] = useState<{
    leadsNewWeek: number;
    leadsNewMonth: number;
    leadsConvertedWeek: number;
    leadsConvertedMonth: number;
    proposalsWeek: number;
    proposalsMonth: number;
  } | null>(null);
  const [arSummary, setArSummary] = useState<{
    outstanding: number;
    overdue: number;
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90p: number;
  } | null>(null);
  const [tasksToday, setTasksToday] = useState<any[]>([]);
  const [tasksOverdue, setTasksOverdue] = useState<any[]>([]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // Jobs for pipeline counts (filter by branch when set)
        let jq = supabase
          .from('jobs')
          .select('status')
          .order('created_at', { ascending: false });
        if (branchId !== 'all') jq = jq.eq('branch_id', branchId as string);

        // Leads follow-ups due today (open only)
        let lq = supabase
          .from('leads')
          .select('id, name, phone, next_follow_up_date, branch_id')
          .eq('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost');
        if (branchId !== 'all') lq = lq.eq('branch_id', branchId as string);

        // Overdue invoices (due_date < today and status != Paid), branch-scoped using join filter
        let invQ = supabase
          .from('invoices')
          .select('id, due_date, status, job_id, total, jobs!inner(branch_id)')
          .lt('due_date', today)
          .neq('status', 'Paid')
          .order('due_date', { ascending: true })
          .limit(10);
        if (branchId !== 'all') invQ = invQ.eq('jobs.branch_id', branchId as string);

        // Recent proposals (filter by branch via join)
        let ppQ = supabase
          .from('proposals')
          .select('id, date, total, pdf_url, job_id, jobs!inner(branch_id)')
          .order('date', { ascending: false })
          .limit(5);
        if (branchId !== 'all') ppQ = ppQ.eq('jobs.branch_id', branchId as string);

        // Recent payments (filter by branch via join to invoices and jobs)
        let payQ = supabase
          .from('payments')
          .select('id, date, amount, invoice_id, invoices!inner(job_id, jobs!inner(branch_id))')
          .order('date', { ascending: false })
          .limit(5);
        if (branchId !== 'all')
          payQ = payQ.eq('invoices.jobs.branch_id', branchId as string);

        // Tasks: due today and overdue (status != Done), branch-scoped via join
        const tTodayPromise: any =
          branchId === 'all'
            ? supabase
                .from('tasks')
                .select('id, title, status, due_date, job_id')
                .eq('due_date', today)
                .neq('status', 'Done')
                .order('due_date', { ascending: true })
                .limit(8)
            : supabase
                .from('tasks')
                .select('id, title, status, due_date, job_id, jobs!inner(branch_id)')
                .eq('due_date', today)
                .neq('status', 'Done')
                .order('due_date', { ascending: true })
                .eq('jobs.branch_id', branchId as string)
                .limit(8);
        const tOverPromise: any =
          branchId === 'all'
            ? supabase
                .from('tasks')
                .select('id, title, status, due_date, job_id')
                .lt('due_date', today)
                .neq('status', 'Done')
                .order('due_date', { ascending: true })
                .limit(8)
            : supabase
                .from('tasks')
                .select('id, title, status, due_date, job_id, jobs!inner(branch_id)')
                .lt('due_date', today)
                .neq('status', 'Done')
                .order('due_date', { ascending: true })
                .eq('jobs.branch_id', branchId as string)
                .limit(8);
        const tasksPromise = Promise.all([tTodayPromise, tOverPromise]);

        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const kpisPromise = token
          ? fetch(
              branchId === 'all'
                ? '/api/overview/kpis'
                : `/api/overview/kpis?branchId=${encodeURIComponent(
                    branchId as string,
                  )}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            ).then(async (res) => ({ res, out: await res.json() }))
          : Promise.resolve(null);
        const arPromise = token
          ? fetch(
              branchId === 'all'
                ? '/api/overview/ar'
                : `/api/overview/ar?branchId=${encodeURIComponent(
                    branchId as string,
                  )}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            ).then(async (res) => ({ res, out: await res.json() }))
          : Promise.resolve(null);

        const [
          { data: j },
          { data: l },
          { data: inv },
          { data: pp },
          { data: pay },
          tasksRes,
          kpisRes,
          arRes,
        ] = await Promise.all([
          jq,
          lq,
          invQ,
          ppQ,
          payQ,
          tasksPromise,
          kpisPromise,
          arPromise,
        ]);

        if (!alive) return;

        setJobs(j || []);
        setLeadsDue(l || []);
        setOverdueInvoices(inv || []);
        setRecentProposals(pp || []);
        setRecentPayments(pay || []);
        const map: Record<string, string> = {};
        for (const p of (pay as any[]) || []) {
          const invRow: any = (p as any).invoices || {};
          if (invRow?.job_id) map[p.invoice_id] = invRow.job_id;
        }
        setPaymentInvoiceJobMap(map);

        const [tTodayRes, tOverRes] = tasksRes || [];
        setTasksToday(((tTodayRes as any)?.data as any[]) || []);
        setTasksOverdue(((tOverRes as any)?.data as any[]) || []);

        if (kpisRes && kpisRes.res.ok && kpisRes.out?.ok) {
          const out = kpisRes.out;
          if (out.scope === 'branch') {
            setLeadSummary({
              total: out.total || 0,
              open: out.open || 0,
              dueToday: out.dueToday || 0,
              overdue: out.overdue || 0,
            });
            setSalesKpis({
              leadsNewWeek: out.newWeek || 0,
              leadsNewMonth: out.leadsNewMonth || 0,
              leadsConvertedWeek: out.converted || 0,
              leadsConvertedMonth: out.leadsConvertedMonth || 0,
              proposalsWeek: out.proposalsWeek || 0,
              proposalsMonth: out.proposalsMonth || 0,
            });
          } else {
            const per = Array.isArray(out.perBranch) ? out.perBranch : [];
            const total =
              per.reduce((a: number, b: any) => a + (b.total || 0), 0) +
              (out.unassigned?.total || 0);
            const open =
              per.reduce((a: number, b: any) => a + (b.open || 0), 0) +
              (out.unassigned?.open || 0);
            const dueToday =
              per.reduce((a: number, b: any) => a + (b.dueToday || 0), 0) +
              (out.unassigned?.dueToday || 0);
            const overdue =
              per.reduce((a: number, b: any) => a + (b.overdue || 0), 0) +
              (out.unassigned?.overdue || 0);
            setLeadSummary({ total, open, dueToday, overdue });
            setSalesKpis({
              leadsNewWeek:
                per.reduce((a: number, b: any) => a + (b.newWeek || 0), 0) +
                (out.unassigned?.newWeek || 0),
              leadsNewMonth: out.leadsNewMonth || 0,
              leadsConvertedWeek:
                per.reduce((a: number, b: any) => a + (b.converted || 0), 0) +
                (out.unassigned?.converted || 0),
              leadsConvertedMonth: out.leadsConvertedMonth || 0,
              proposalsWeek: out.proposalsWeek || 0,
              proposalsMonth: out.proposalsMonth || 0,
            });
          }
        } else {
          setLeadSummary(null);
          setSalesKpis(null);
        }

        if (arRes && arRes.res.ok && arRes.out?.ok) {
          const out = arRes.out;
          setArSummary({
            outstanding: out.outstanding || 0,
            overdue: out.overdue || 0,
            current: out.current || 0,
            d1_30: out.d1_30 || 0,
            d31_60: out.d31_60 || 0,
            d61_90: out.d61_90 || 0,
            d90p: out.d90p || 0,
          });
        } else {
          setArSummary(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [branchId, supabase, today]);

  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of jobs) map[j.status] = (map[j.status] || 0) + 1;
    return map;
  }, [jobs]);

  const fCurr = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="min-w-[220px]">
          <BranchSelect value={branchId} onChange={setBranchId} />
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {JOB_STATUSES.map((s) => (
          <a
            key={s}
            className="rounded border bg-white p-3 text-center hover:bg-gray-50"
            href="/jobs"
          >
            <div className="text-xs text-gray-500">{statusLabel(s as any)}</div>
            <div className="text-lg font-semibold">
              {pipelineCounts[s] || 0}
            </div>
          </a>
        ))}
      </div>

      {/* Leads summary: Total and Open (CRM leads) */}
      {leadSummary && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500" title="CRM leads in the leads table (all statuses)">Leads Total (CRM)</div>
            <div className="text-lg font-semibold">{leadSummary.total}</div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500" title="CRM leads that are not Converted/Closed/Lost">Leads Open (CRM)</div>
            <div className="text-lg font-semibold">{leadSummary.open}</div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500" title="CRM leads whose next follow-up date is today">Leads Due Today</div>
            <div
              className={`text-lg font-semibold ${leadSummary.dueToday > 0 ? 'text-red-600' : ''}`}
            >
              {leadSummary.dueToday}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500" title="CRM leads whose next follow-up is overdue">Leads Overdue</div>
            <div
              className={`text-lg font-semibold ${leadSummary.overdue > 0 ? 'text-red-600' : ''}`}
            >
              {leadSummary.overdue}
            </div>
          </div>
        </div>
      )}

      {/* Sales KPIs (derived from CRM + proposals) */}
      {salesKpis && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">New Leads (WTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.leadsNewWeek}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">New Leads (MTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.leadsNewMonth}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Converted (WTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.leadsConvertedWeek}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Converted (MTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.leadsConvertedMonth}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Proposals (WTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.proposalsWeek}
            </div>
          </div>
          <div className="rounded border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Proposals (MTD)</div>
            <div className="text-lg font-semibold">
              {salesKpis.proposalsMonth}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Follow-ups Today">
          {leadsDue.length === 0 ? (
            <div className="text-sm text-gray-600">
              No follow-ups due today.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {leadsDue.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {l.name || '—'} • {l.phone || '—'}
                  </span>
                  <div className="flex items-center gap-2">
                    <QuickContact phone={l.phone} messageTemplate={`Hi ${l.name || ''}, following up on your solar enquiry.`} />
                    <a className="text-[var(--primary-600)]" href="/leads">
                      Open
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Overdue Invoices">
          {overdueInvoices.length === 0 ? (
            <div className="text-sm text-gray-600">No overdue invoices.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {overdueInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between">
                  <span>
                    {fCurr.format(Number(i.total || 0))} • Due{' '}
                    {i.due_date || '—'}
                  </span>
                  <a
                    className="text-[var(--primary-600)]"
                    href={`/jobs/${i.job_id}?tab=finance`}
                  >
                    Collect
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Proposals">
          {recentProposals.length === 0 ? (
            <div className="text-sm text-gray-600">No proposals yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentProposals.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>
                    {p.date || '—'} • {fCurr.format(Number(p.total || 0))}
                  </span>
                  <a
                    className="text-[var(--primary-600)]"
                    href={`/jobs/${p.job_id}?tab=proposals`}
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Payments">
          {recentPayments.length === 0 ? (
            <div className="text-sm text-gray-600">No payments recorded.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>
                    {fCurr.format(Number(p.amount || 0))} • {p.date || '—'}
                  </span>
                  {paymentInvoiceJobMap[p.invoice_id] ? (
                    <a
                      className="text-[var(--primary-600)]"
                      href={`/jobs/${paymentInvoiceJobMap[p.invoice_id]}?tab=finance`}
                    >
                      Finance
                    </a>
                  ) : (
                    <a className="text-[var(--primary-600)]" href="/jobs">
                      Jobs
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* AR Summary */}
      {arSummary && (
        <Card title="Accounts Receivable">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="text-lg font-semibold">
                {fCurr.format(arSummary.outstanding)}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Overdue</div>
              <div
                className={`text-lg font-semibold ${arSummary.overdue > 0 ? 'text-red-600' : ''}`}
              >
                {fCurr.format(arSummary.overdue)}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">Current</div>
              <div className="text-lg font-semibold">
                {fCurr.format(arSummary.current)}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">1–30</div>
              <div className="text-lg font-semibold">
                {fCurr.format(arSummary.d1_30)}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">31–60</div>
              <div className="text-lg font-semibold">
                {fCurr.format(arSummary.d31_60)}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-center">
              <div className="text-xs text-gray-500">61–90 / 90+</div>
              <div className="text-xs">
                <span className="font-semibold mr-2">
                  {fCurr.format(arSummary.d61_90)}
                </span>
                <span className="font-semibold">
                  {fCurr.format(arSummary.d90p)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tasks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Tasks Due Today">
          {tasksToday.length === 0 ? (
            <div className="text-sm text-gray-600">No tasks due today.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {tasksToday.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="truncate">{t.title || '—'}</span>
                  <a
                    className="text-[var(--primary-600)]"
                    href={`/jobs/${t.job_id}?tab=tasks`}
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Tasks Overdue">
          {tasksOverdue.length === 0 ? (
            <div className="text-sm text-gray-600">No overdue tasks.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {tasksOverdue.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span>
                    {t.title || '—'} • Due {t.due_date || '—'}
                  </span>
                  <a
                    className="text-[var(--primary-600)]"
                    href={`/jobs/${t.job_id}?tab=tasks`}
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => (window.location.href = '/leads')}>
          Add Lead
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = '/proposals/new')}
        >
          New Proposal
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = '/jobs')}
        >
          Open Pipeline
        </Button>
      </div>
    </div>
  );
}
