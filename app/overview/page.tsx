"use client";
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Button from '~/components/ui/Button';
import BranchSelect from '~/components/BranchSelect';

export default function OverviewPage() {
  const supabase = supabaseBrowser();
  const [branchId, setBranchId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [leadsDue, setLeadsDue] = useState<any[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [recentProposals, setRecentProposals] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Jobs for pipeline counts (filter by branch when set)
        let jq = supabase
          .from('jobs')
          .select('id, status, branch_id')
          .order('created_at', { ascending: false });
        if (branchId !== 'all') jq = jq.eq('branch_id', branchId as string);
        const { data: j } = await jq;
        setJobs(j || []);

        // Leads due today
        let lq = supabase
          .from('leads')
          .select('id, name, phone, next_follow_up_date, branch_id')
          .eq('next_follow_up_date', today);
        if (branchId !== 'all') lq = lq.eq('branch_id', branchId as string);
        const { data: l } = await lq;
        setLeadsDue(l || []);

        // Overdue invoices (due_date < today and status != Paid)
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, due_date, status, job_id, total')
          .lt('due_date', today)
          .neq('status', 'Paid')
          .order('due_date', { ascending: true })
          .limit(10);
        setOverdueInvoices(inv || []);

        // Recent proposals
        const { data: pp } = await supabase
          .from('proposals')
          .select('id, date, total, pdf_url, job_id')
          .order('date', { ascending: false })
          .limit(5);
        setRecentProposals(pp || []);

        // Recent payments
        const { data: pay } = await supabase
          .from('payments')
          .select('id, date, amount, invoice_id')
          .order('date', { ascending: false })
          .limit(5);
        setRecentPayments(pay || []);
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
        {[
          'Lead',
          'Qualified',
          'Quoted',
          'Won',
          'KSEB_Submitted',
          'Installed',
          'Net_Metered',
          'Handover',
        ].slice(0,5).map((s) => (
          <a key={s} className="rounded border bg-white p-3 text-center hover:bg-gray-50" href="/jobs">
            <div className="text-xs text-gray-500">{s.replace(/_/g, ' ')}</div>
            <div className="text-lg font-semibold">{pipelineCounts[s] || 0}</div>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Follow-ups Today">
          {leadsDue.length === 0 ? (
            <div className="text-sm text-gray-600">No follow-ups due today.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {leadsDue.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span className="truncate">{l.name || '—'} • {l.phone || '—'}</span>
                  <a className="text-blue-600" href="/leads">Open</a>
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
                  <span>₹{i.total ?? '—'} • Due {i.due_date || '—'}</span>
                  <a className="text-blue-600" href={`/jobs/${i.job_id}?tab=finance`}>Collect</a>
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
                  <span>{p.date || '—'} • ₹{p.total ?? '—'}</span>
                  <a className="text-blue-600" href={`/jobs/${p.job_id}?tab=proposals`}>Open</a>
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
                  <span>₹{p.amount ?? '—'} • {p.date || '—'}</span>
                  <a className="text-blue-600" href="/jobs">Jobs</a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => (window.location.href = '/leads')}>Add Lead</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/proposals/new')}>New Proposal</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/jobs')}>Open Pipeline</Button>
      </div>
    </div>
  );
}
