import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { jobId, newStatus } = (await req.json()) as { jobId: string; newStatus: string };
    const sb = supabaseFromAuthHeader();
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // Load job under RLS
    const { data: job, error: jErr } = await sb.from('jobs').select('*').eq('id', jobId).single();
    if (jErr || !job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const { error: upErr } = await sb.from('jobs').update({ status: newStatus }).eq('id', jobId);
    if (upErr) throw upErr;

    if (newStatus === 'Won') {
      const { data: settings } = await sb.from('settings').select('*').eq('tenant_id', job.tenant_id).single();
      const depositPercent = Number((settings as any)?.deposit_percent || 0);
      const total = Number(job.total_amount || job.quoted_price || 0);
      const deposit = Math.round((total * depositPercent) / 100);
      if (deposit > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        await sb.from('invoices').insert({
          tenant_id: job.tenant_id,
          job_id: job.id,
          date: new Date().toISOString().slice(0, 10),
          invoice_type: 'Deposit',
          amount_before_tax: deposit,
          tax: 0,
          total: deposit,
          due_date: dueDate.toISOString().slice(0, 10),
          status: 'Draft',
        });
        await sb
          .from('jobs')
          .update({ deposit_amount: deposit, balance_due: total - deposit })
          .eq('id', job.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
