import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

function startOfWeekMondayISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const sow = new Date(d);
  sow.setHours(0, 0, 0, 0);
  sow.setDate(d.getDate() + diffToMon);
  return sow.toISOString().slice(0, 10);
}

async function count(sb: any, table: string, apply?: (q: any) => any) {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId');
    const today = new Date().toISOString().slice(0, 10);
    const startOfWeek = startOfWeekMondayISO();
    const monthStart = (() => {
      const d = new Date();
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    })();

    if (branchId) {
      // Leads KPIs (branch)
      const [total, open, dueToday, overdue, newWeek, converted, leadsNewMonth, leadsConvertedMonth] = await Promise.all([
        count(sb, 'leads', (q) => q.eq('branch_id', branchId)),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).neq('status', 'Converted').neq('status', 'Closed').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).eq('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).lte('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).gte('date', startOfWeek)),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).eq('status', 'Converted')),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).gte('date', monthStart)),
        count(sb, 'leads', (q) => q.eq('branch_id', branchId).eq('status', 'Converted').gte('date', monthStart)),
      ]);
      // Proposals (branch)
      const [proposalsWeek, proposalsMonth] = await Promise.all([
        count(sb, 'proposals', (q: any) =>
          q.select('id, jobs!inner(branch_id)', { count: 'exact', head: true }).eq('jobs.branch_id', branchId).gte('date', startOfWeek),
        ),
        count(sb, 'proposals', (q: any) =>
          q.select('id, jobs!inner(branch_id)', { count: 'exact', head: true }).eq('jobs.branch_id', branchId).gte('date', monthStart),
        ),
      ]);
      return NextResponse.json({
        ok: true,
        scope: 'branch',
        branchId,
        today,
        startOfWeek,
        total,
        open,
        dueToday,
        overdue,
        newWeek,
        converted,
        leadsNewMonth,
        leadsConvertedMonth,
        proposalsWeek,
        proposalsMonth,
      });
    }

    // Aggregate across all branches (RLS applies tenant scope)
    const [leadsNewMonth, leadsConvertedMonth, proposalsWeek, proposalsMonth] = await Promise.all([
      count(sb, 'leads', (q) => q.gte('date', monthStart)),
      count(sb, 'leads', (q) => q.eq('status', 'Converted').gte('date', monthStart)),
      count(sb, 'proposals', (q: any) => q.gte('date', startOfWeek)),
      count(sb, 'proposals', (q: any) => q.gte('date', monthStart)),
    ]);

    // Per-branch leads summary: reuse existing leads/kpis logic by pulling branches list then counting
    const { data: branches } = await sb.from('branches').select('id, name').order('name');
    const perTasks = ((branches as any[]) || []).map(async (b) => {
      const [total, open, dueToday, overdue, newWeek, converted] = await Promise.all([
        count(sb, 'leads', (q) => q.eq('branch_id', b.id)),
        count(sb, 'leads', (q) => q.eq('branch_id', b.id).neq('status', 'Converted').neq('status', 'Closed').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', b.id).eq('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', b.id).lte('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
        count(sb, 'leads', (q) => q.eq('branch_id', b.id).gte('date', startOfWeek)),
        count(sb, 'leads', (q) => q.eq('branch_id', b.id).eq('status', 'Converted')),
      ]);
      return { branchId: b.id as string, name: b.name as string, total, open, dueToday, overdue, newWeek, converted };
    });

    const [
      totalNull,
      openNull,
      dueTodayNull,
      overdueNull,
      newWeekNull,
      convertedNull,
    ] = await Promise.all([
      count(sb, 'leads', (q) => q.is('branch_id', null)),
      count(sb, 'leads', (q) => q.is('branch_id', null).neq('status', 'Converted').neq('status', 'Closed').neq('status', 'Lost')),
      count(sb, 'leads', (q) => q.is('branch_id', null).eq('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
      count(sb, 'leads', (q) => q.is('branch_id', null).lte('next_follow_up_date', today).neq('status', 'Closed').neq('status', 'Converted').neq('status', 'Lost')),
      count(sb, 'leads', (q) => q.is('branch_id', null).gte('date', startOfWeek)),
      count(sb, 'leads', (q) => q.is('branch_id', null).eq('status', 'Converted')),
    ]);

    const perBranch = await Promise.all(perTasks);
    return NextResponse.json({
      ok: true,
      scope: 'all',
      today,
      startOfWeek,
      perBranch,
      unassigned: {
        name: 'Unassigned',
        total: totalNull,
        open: openNull,
        dueToday: dueTodayNull,
        overdue: overdueNull,
        newWeek: newWeekNull,
        converted: convertedNull,
      },
      leadsNewMonth,
      leadsConvertedMonth,
      proposalsWeek,
      proposalsMonth,
    });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/overview/kpis', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}

