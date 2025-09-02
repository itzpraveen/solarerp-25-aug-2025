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

    // Single RPC that aggregates all KPIs
    const { data: rows, error } = await sb.rpc('overview_kpis_agg', {
      _today: today,
      _sow: startOfWeek,
      _month: monthStart,
    });
    if (error) throw error;
    const list: any[] = (rows as any[]) || [];

    if (branchId) {
      const r = list.find((x) => x.branch_id === branchId && x.is_total === false);
      const out = {
        ok: true,
        scope: 'branch' as const,
        branchId,
        today,
        startOfWeek,
        total: r?.total || 0,
        open: r?.open || 0,
        dueToday: r?.due_today || 0,
        overdue: r?.overdue || 0,
        newWeek: r?.new_week || 0,
        converted: r?.converted_total || 0,
        leadsNewMonth: r?.leads_new_month || 0,
        leadsConvertedMonth: r?.leads_converted_month || 0,
        proposalsWeek: r?.proposals_week || 0,
        proposalsMonth: r?.proposals_month || 0,
      };
      const res = NextResponse.json(out);
      res.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
      return res;
    }

    const totalRow = list.find((x) => x.is_total === true) || {};
    const unassignedRow = list.find((x) => x.is_total === false && x.branch_id == null) || {};
    const branchRows = list.filter((x) => x.is_total === false && x.branch_id != null);
    const { data: branches } = await sb.from('branches').select('id, name');
    const nameById = new Map<string, string>();
    for (const b of (branches as any[]) || []) nameById.set(b.id, b.name || '—');

    const perBranch = branchRows.map((r) => ({
      branchId: r.branch_id as string,
      name: nameById.get(r.branch_id) || '—',
      total: Number(r.total || 0),
      open: Number(r.open || 0),
      dueToday: Number(r.due_today || 0),
      overdue: Number(r.overdue || 0),
      newWeek: Number(r.new_week || 0),
      converted: Number(r.converted_total || 0),
    }));

    const body = {
      ok: true,
      scope: 'all' as const,
      today,
      startOfWeek,
      perBranch,
      unassigned: {
        name: 'Unassigned',
        total: Number(unassignedRow.total || 0),
        open: Number(unassignedRow.open || 0),
        dueToday: Number(unassignedRow.due_today || 0),
        overdue: Number(unassignedRow.overdue || 0),
        newWeek: Number(unassignedRow.new_week || 0),
        converted: Number(unassignedRow.converted_total || 0),
      },
      leadsNewMonth: Number(totalRow.leads_new_month || 0),
      leadsConvertedMonth: Number(totalRow.leads_converted_month || 0),
      proposalsWeek: Number(totalRow.proposals_week || 0),
      proposalsMonth: Number(totalRow.proposals_month || 0),
    };
    const res = NextResponse.json(body);
    res.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    return res;
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/overview/kpis', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
