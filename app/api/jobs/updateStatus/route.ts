import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { jobId, newStatus } = (await req.json()) as { jobId: string; newStatus: string };
    const admin = supabaseAdmin();

    // Load job and tenant settings
    const { data: job } = await admin.from('jobs').select('*').eq('id', jobId).single();
    if (!job) throw new Error('Job not found');

    await admin.from('jobs').update({ status: newStatus }).eq('id', jobId);

    if (newStatus === 'Won') {
      const { data: settings } = await admin.from('settings').select('*').eq('tenant_id', job.tenant_id).single();
      const depositPercent = Number(settings?.deposit_percent || 0);
      const total = Number(job.total_amount || job.quoted_price || 0);
      const deposit = Math.round((total * depositPercent) / 100);
      if (deposit > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        await admin.from('invoices').insert({
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
        await admin
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
