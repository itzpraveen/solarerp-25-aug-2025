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

// Supabase v2 exposes filter methods (eq/neq/is/gt/...) only after a select/update/delete.
// So always call select() first, then apply filters via the provided callback.
async function count(
  sb: any,
  table: string,
  apply?: (q: any) => any,
): Promise<number> {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );

    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId'); // if absent → aggregate per branch
    const today = new Date().toISOString().slice(0, 10);
    const startOfWeek = startOfWeekMondayISO();
    // Resolve tenant for safer RLS-compliant filtering
    const { data: meProfile } = await sb
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const tenantId = (meProfile as any)?.tenant_id as string | undefined;

    if (branchId) {
      // KPIs for a specific branch (fresh select + filters per count)
      const total = await count(sb, 'leads', (q) => q.eq('branch_id', branchId));
      const open = await count(sb, 'leads', (q) =>
        q
          .eq('branch_id', branchId)
          .neq('status', 'Converted')
          .neq('status', 'Closed')
          .neq('status', 'Lost'),
      );
      const dueToday = await count(sb, 'leads', (q) =>
        q
          .eq('branch_id', branchId)
          .eq('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost'),
      );
      const overdue = await count(sb, 'leads', (q) =>
        q
          .eq('branch_id', branchId)
          .lte('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost'),
      );
      const newWeek = await count(sb, 'leads', (q) =>
        q.eq('branch_id', branchId).gte('date', startOfWeek),
      );
      const converted = await count(sb, 'leads', (q) =>
        q.eq('branch_id', branchId).eq('status', 'Converted'),
      );
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
      });
    }

    // Aggregate per branch for current tenant.
    // RLS limits rows to caller's tenant automatically.
    const branchesBase = sb.from('branches').select('id, name');
    const branchesQuery = tenantId
      ? branchesBase.match({ tenant_id: tenantId })
      : branchesBase;
    const { data: branches, error: bErr } = await branchesQuery.order('name');
    // If branch query fails due to RLS or other reasons, continue with empty branch list.
    const list = bErr ? [] : (branches as any[]) || [];

    const tasks = list.map(async (b) => {
      const [total, open, dueToday, overdue, newWeek, converted] =
        await Promise.all([
          count(sb, 'leads', (q) => q.eq('branch_id', b.id)),
          count(sb, 'leads', (q) =>
            q
              .eq('branch_id', b.id)
              .neq('status', 'Converted')
              .neq('status', 'Closed')
              .neq('status', 'Lost'),
          ),
          count(sb, 'leads', (q) =>
            q
              .eq('branch_id', b.id)
              .eq('next_follow_up_date', today)
              .neq('status', 'Closed')
              .neq('status', 'Converted')
              .neq('status', 'Lost'),
          ),
          count(sb, 'leads', (q) =>
            q
              .eq('branch_id', b.id)
              .lte('next_follow_up_date', today)
              .neq('status', 'Closed')
              .neq('status', 'Converted')
              .neq('status', 'Lost'),
          ),
          count(sb, 'leads', (q) =>
            q.eq('branch_id', b.id).gte('date', startOfWeek),
          ),
          count(sb, 'leads', (q) =>
            q.eq('branch_id', b.id).eq('status', 'Converted'),
          ),
        ]);
      return {
        branchId: b.id as string,
        name: b.name as string,
        total,
        open,
        dueToday,
        overdue,
        newWeek,
        converted,
      };
    });

    // Also compute unassigned (null branch)
    const [
      totalNull,
      openNull,
      dueTodayNull,
      overdueNull,
      newWeekNull,
      convertedNull,
    ] = await Promise.all([
      count(sb, 'leads', (q) => q.is('branch_id', null)),
      count(sb, 'leads', (q) =>
        q
          .is('branch_id', null)
          .neq('status', 'Converted')
          .neq('status', 'Closed')
          .neq('status', 'Lost'),
      ),
      count(sb, 'leads', (q) =>
        q
          .is('branch_id', null)
          .eq('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost'),
      ),
      count(sb, 'leads', (q) =>
        q
          .is('branch_id', null)
          .lte('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost'),
      ),
      count(sb, 'leads', (q) => q.is('branch_id', null).gte('date', startOfWeek)),
      count(sb, 'leads', (q) =>
        q.is('branch_id', null).eq('status', 'Converted'),
      ),
    ]);

    const perBranch = await Promise.all(tasks);
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
    });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/leads/kpis', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
