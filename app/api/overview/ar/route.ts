import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );

    const url = new URL(req.url);
    const branchParam = url.searchParams.get('branchId');
    const branchId = branchParam && branchParam !== 'all' ? branchParam : null;
    const today = new Date().toISOString().slice(0, 10);

    // Fetch open invoices (not Paid/Cancelled), branch-scoped via join if needed
    let arInvQ = sb
      .from('invoices')
      .select('id, total, due_date, status, job_id')
      .neq('status', 'Paid')
      .neq('status', 'Cancelled');
    if (branchId) {
      arInvQ = sb
        .from('invoices')
        .select('id, total, due_date, status, job_id, jobs!inner(branch_id)')
        .neq('status', 'Paid')
        .neq('status', 'Cancelled')
        .eq('jobs.branch_id', branchId);
    }

    const { data: arInv, error: invError } = await arInvQ;
    if (invError) throw invError;

    const invoiceRows = ((arInv as any[]) || []).filter(
      (r) => Number(r.total || 0) > 0,
    );
    const invIds = invoiceRows.map((r) => r.id);
    let payRows: any[] = [];
    if (invIds.length > 0) {
      const { data: payForInv, error: payError } = await sb
        .from('payments')
        .select('invoice_id, amount')
        .in('invoice_id', invIds as any)
        .limit(5000);
      if (payError) throw payError;
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

    const res = NextResponse.json({
      ok: true,
      today,
      outstanding,
      overdue,
      current,
      d1_30,
      d31_60,
      d61_90,
      d90p,
    });
    res.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    return res;
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/overview/ar', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
