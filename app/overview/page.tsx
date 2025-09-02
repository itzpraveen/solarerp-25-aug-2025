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
    (async () => {
      setLoading(true);
      try {
        const formatDate = (d: Date) => d.toISOString().slice(0, 10);
        const monthStart = (() => {
          const d = new Date();
          d.setDate(1);
          return formatDate(d);
        })();

        // Jobs for pipeline counts (filter by branch when set)
        let jq = supabase
          .from('jobs')
          .select('id, status, branch_id')
          .order('created_at', { ascending: false });
        if (branchId !== 'all') jq = jq.eq('branch_id', branchId as string);
        const { data: j } = await jq;
        setJobs(j || []);

        // Build job id list for branch scoping of finance and tasks widgets
        const jobIds: string[] = (Array.isArray(j) ? j : [])
          .map((row: any) => row.id)
          .filter(Boolean);

        // Leads follow-ups due today (open only)
        let lq = supabase
          .from('leads')
          .select('id, name, phone, next_follow_up_date, branch_id')
          .eq('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost');
        if (branchId !== 'all') lq = lq.eq('branch_id', branchId as string);
        const { data: l } = await lq;
        setLeadsDue(l || []);

        // Overdue invoices (due_date < today and status != Paid), branch-scoped using join filter
        let invQ = supabase
          .from('invoices')
          .select('id, due_date, status, job_id, total, jobs!inner(branch_id)')
          .lt('due_date', today)
          .neq('status', 'Paid')
          .order('due_date', { ascending: true })
          .limit(10);
        if (branchId !== 'all') invQ = invQ.eq('jobs.branch_id', branchId as string);
        const { data: inv } = await invQ;
        setOverdueInvoices(inv || []);

        // Recent proposals (filter by branch via join)
        let ppQ = supabase
          .from('proposals')
          .select('id, date, total, pdf_url, job_id, jobs!inner(branch_id)')
          .order('date', { ascending: false })
          .limit(5);
        if (branchId !== 'all') ppQ = ppQ.eq('jobs.branch_id', branchId as string);
        const { data: pp } = await ppQ;
        setRecentProposals(pp || []);

        // Recent payments (filter by branch via join to invoices and jobs)
        let payQ = supabase
          .from('payments')
          .select('id, date, amount, invoice_id, invoices!inner(job_id), invoices(jobs!inner(branch_id))')
          .order('date', { ascending: false })
          .limit(5);
        if (branchId !== 'all')
          payQ = payQ.eq('invoices.jobs.branch_id', branchId as string);
        const { data: pay } = await payQ;
        setRecentPayments(pay || []);
        const map: Record<string, string> = {};
        for (const p of (pay as any[]) || []) {
          const inv: any = (p as any).invoices || {};
          if (inv?.job_id) map[p.invoice_id] = inv.job_id;
        }
        setPaymentInvoiceJobMap(map);

        // Leads KPIs (Total/Open)
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (token) {
          const url =
            branchId === 'all'
              ? '/api/overview/kpis'
              : `/api/overview/kpis?branchId=${encodeURIComponent(branchId as string)}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const out = await res.json();
          if (res.ok && out?.ok) {
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
        } else {
          setLeadSummary(null);
          setSalesKpis(null);
        }

        // Tasks: due today and overdue (status != Done), branch-scoped via join
        let tTodayQ = supabase
          .from('tasks')
          .select('id, title, status, due_date, job_id')
          .eq('due_date', today)
          .neq('status', 'Done')
          .order('due_date', { ascending: true })
          .limit(8);
        let tOverQ = supabase
          .from('tasks')
          .select('id, title, status, due_date, job_id')
          .lt('due_date', today)
          .neq('status', 'Done')
          .order('due_date', { ascending: true })
          .limit(8);
        const tTodayPromise: any =
          branchId === 'all'
            ? tTodayQ
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
            ? tOverQ
            : supabase
                .from('tasks')
                .select('id, title, status, due_date, job_id, jobs!inner(branch_id)')
                .lt('due_date', today)
                .neq('status', 'Done')
                .order('due_date', { ascending: true })
                .eq('jobs.branch_id', branchId as string)
                .limit(8);
        const [{ data: ttd }, { data: tov }] = await Promise.all([
          tTodayPromise,
          tOverPromise,
        ]);
        setTasksToday((ttd as any[]) || []);
        setTasksOverdue((tov as any[]) || []);

        // AR Summary: compute outstanding per invoice (sum(invoice.total - payments)) and bucket by aging
        // 1) fetch open invoices (not Paid/Cancelled)
        let arInvQ = supabase
          .from('invoices')
          .select('id, total, due_date, status, job_id, jobs!inner(branch_id)')
          .neq('status', 'Paid')
          .neq('status', 'Cancelled');
        if (branchId !== 'all') arInvQ = arInvQ.eq('jobs.branch_id', branchId as string);
        const { data: arInv } = await arInvQ;
        const invoiceRows = ((arInv as any[]) || []).filter(
          (r) => Number(r.total || 0) > 0,
        );
        const invIds = invoiceRows.map((r) => r.id);
        let payRows: any[] = [];
        if (invIds.length > 0) {
          const { data: payForInv } = await supabase
            .from('payments')
            .select('invoice_id, amount')
            .in('invoice_id', invIds as any)
            .limit(5000);
          payRows = (payForInv as any[]) || [];
        }
        const paidByInv = new Map<string, number>();
        for (const p of payRows) {
          const k = p.invoice_id as string;
          const v = Number(p.amount || 0);
          paidByInv.set(k, (paidByInv.get(k) || 0) + v);
        }
        const todayDate = new Date(today);
        let outstanding = 0;
        let overdue = 0;
        let current = 0;
        let d1_30 = 0;
        let d31_60 = 0;
        let d61_90 = 0;
        let d90p = 0;
        for (const invRow of invoiceRows) {
          const tot = Number(invRow.total || 0);
          const paid = Number(paidByInv.get(invRow.id) || 0);
          const due = Math.max(0, tot - paid);
          if (due <= 0) continue;
          outstanding += due;
          const dueDateStr = invRow.due_date as string | null;
          if (!dueDateStr) {
            // No due date, treat as current
            current += due;
            continue;
          }
          const d = new Date(dueDateStr);
          const diffDays = Math.floor(
            (todayDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays <= 0) {
            current += due;
          } else if (diffDays <= 30) {
            overdue += due;
            d1_30 += due;
          } else if (diffDays <= 60) {
            overdue += due;
            d31_60 += due;
          } else if (diffDays <= 90) {
            overdue += due;
            d61_90 += due;
          } else {
            overdue += due;
            d90p += due;
          }
        }
        setArSummary({
          outstanding,
          overdue,
          current,
          d1_30,
          d31_60,
          d61_90,
          d90p,
        });
      } finally {
        setLoading(false);
      }
    })();
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
                    <a className="text-blue-600" href="/leads">
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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
                      className="text-blue-600"
                      href={`/jobs/${paymentInvoiceJobMap[p.invoice_id]}?tab=finance`}
                    >
                      Finance
                    </a>
                  ) : (
                    <a className="text-blue-600" href="/jobs">
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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
