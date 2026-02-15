import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

const ListQuery = z.object({
  jobId: z.string().uuid(),
});

const CreateBody = z.object({
  jobId: z.string().uuid(),
  docType: z.string().min(1, 'Document type is required'),
  fileUrl: z.string().url('Valid URL required'),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const jobId = req.nextUrl.searchParams.get('jobId');
    const parsed = ListQuery.safeParse({ jobId });
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'jobId query param required (UUID)' }, { status: 400 });

    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const tenantId = (me as any)?.tenant_id as string | undefined;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: 'Profile not ready' }, { status: 400 });

    // Verify job belongs to tenant
    const { data: job } = await sb
      .from('jobs')
      .select('id')
      .eq('id', parsed.data.jobId)
      .maybeSingle();
    if (!job)
      return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });

    const { data, error } = await sb
      .from('documents')
      .select('id, doc_type, file_url, version, signed_by, signed_date, notes, created_at')
      .eq('job_id', parsed.data.jobId)
      .order('created_at', { ascending: false });

    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, documents: data || [] });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/documents GET', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 },
      );

    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const tenantId = (me as any)?.tenant_id as string | undefined;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: 'Profile not ready' }, { status: 400 });

    // Verify job belongs to tenant
    const { data: job } = await sb
      .from('jobs')
      .select('id')
      .eq('id', parsed.data.jobId)
      .maybeSingle();
    if (!job)
      return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });

    // Get max version for this job + doc type
    const { data: existing } = await sb
      .from('documents')
      .select('version')
      .eq('job_id', parsed.data.jobId)
      .eq('doc_type', parsed.data.docType)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = ((existing as any)?.[0]?.version ?? 0) + 1;

    const { data: doc, error } = await sb
      .from('documents')
      .insert({
        tenant_id: tenantId,
        job_id: parsed.data.jobId,
        doc_type: parsed.data.docType,
        file_url: parsed.data.fileUrl,
        version: nextVersion,
        notes: parsed.data.notes || null,
      })
      .select('id')
      .single();

    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: (doc as any)?.id });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/documents POST', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
