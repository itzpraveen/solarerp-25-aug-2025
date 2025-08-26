import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

function startOfWeekMondayISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diffToMon = day === 0 ? -6 : 1 - day;
  const sow = new Date(d);
  sow.setHours(0, 0, 0, 0);
  sow.setDate(d.getDate() + diffToMon);
  return sow.toISOString().slice(0, 10);
}

async function count(sb: any, base: any) {
  const { count } = await base.select('id', { count: 'exact', head: true });
  return count || 0;
}

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId'); // if absent → aggregate per branch
    const today = new Date().toISOString().slice(0, 10);
    const startOfWeek = startOfWeekMondayISO();

    if (branchId) {
      // KPIs for a specific branch (fresh builder per count to avoid mutation carryover)
      const total = await count(sb, sb.from('leads').eq('branch_id', branchId));
      const dueToday = await count(sb, sb.from('leads').eq('branch_id', branchId).eq('next_follow_up_date', today).neq('status', 'Closed'));
      const overdue = await count(sb, sb.from('leads').eq('branch_id', branchId).lte('next_follow_up_date', today).neq('status', 'Closed'));
      const newWeek = await count(sb, sb.from('leads').eq('branch_id', branchId).gte('date', startOfWeek));
      const converted = await count(sb, sb.from('leads').eq('branch_id', branchId).eq('status', 'Converted'));
      return NextResponse.json({ ok: true, scope: 'branch', branchId, today, startOfWeek, total, dueToday, overdue, newWeek, converted });
    }

    // Aggregate per branch for current tenant.
    // RLS limits rows to caller's tenant automatically.
    const { data: branches, error: bErr } = await sb
      .from('branches')
      .select('id, name')
      .order('name');
    if (bErr) throw bErr;
    const list = (branches as any[]) || [];

    const tasks = list.map(async (b) => {
      const [total, dueToday, overdue, newWeek, converted] = await Promise.all([
        count(sb, sb.from('leads').eq('branch_id', b.id)),
        count(sb, sb.from('leads').eq('branch_id', b.id).eq('next_follow_up_date', today).neq('status', 'Closed')),
        count(sb, sb.from('leads').eq('branch_id', b.id).lte('next_follow_up_date', today).neq('status', 'Closed')),
        count(sb, sb.from('leads').eq('branch_id', b.id).gte('date', startOfWeek)),
        count(sb, sb.from('leads').eq('branch_id', b.id).eq('status', 'Converted')),
      ]);
      return { branchId: b.id as string, name: b.name as string, total, dueToday, overdue, newWeek, converted };
    });

    // Also compute unassigned (null branch)
    const [totalNull, dueTodayNull, overdueNull, newWeekNull, convertedNull] = await Promise.all([
      count(sb, sb.from('leads').is('branch_id', null)),
      count(sb, sb.from('leads').is('branch_id', null).eq('next_follow_up_date', today).neq('status', 'Closed')),
      count(sb, sb.from('leads').is('branch_id', null).lte('next_follow_up_date', today).neq('status', 'Closed')),
      count(sb, sb.from('leads').is('branch_id', null).gte('date', startOfWeek)),
      count(sb, sb.from('leads').is('branch_id', null).eq('status', 'Converted')),
    ]);

    const perBranch = await Promise.all(tasks);
    return NextResponse.json({ ok: true, scope: 'all', today, startOfWeek, perBranch, unassigned: { name: 'Unassigned', total: totalNull, dueToday: dueTodayNull, overdue: overdueNull, newWeek: newWeekNull, converted: convertedNull } });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/leads/kpis', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
