import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ImportMode = 'create' | 'skip' | 'update';

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toISODate(s: string | number | Date | null | undefined): string | null {
  if (!s) return null;
  try {
    if (typeof s === 'number') {
      // Excel date numeric value
      const jsDate = XLSX.SSF.parse_date_code(s as any);
      if (jsDate) {
        const d = new Date(Date.UTC(jsDate.y, (jsDate.m || 1) - 1, jsDate.d || 1));
        return d.toISOString().slice(0, 10);
      }
    }
    const t = String(s).trim();
    if (!t) return null;
    // Try YYYY-MM-DD first
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    // Try DD/MM/YYYY or D/M/YY
    const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += 2000;
      const d = new Date(Date.UTC(yyyy, mm - 1, dd));
      return d.toISOString().slice(0, 10);
    }
    // Fallback: Date.parse
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'Missing file' }, { status: 400 });
    const mode = (form.get('mode') as ImportMode) || 'create';
    const defaultBranchId = (form.get('branchId') as string) || '';
    const createBranches = String(form.get('createBranches') || 'false') === 'true';

    // Determine tenant
    const { data: prof } = await sb.from('profiles').select('tenant_id').maybeSingle();
    const tenantId = (prof as any)?.tenant_id as string | undefined;
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Profile not ready' }, { status: 400 });

    // Read workbook
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rowsRaw = XLSX.utils.sheet_to_json<any>(ws, { defval: '', raw: true });
    if (!rowsRaw.length) return NextResponse.json({ ok: false, error: 'No rows found' }, { status: 400 });

    // Normalize headers
    const headers = Object.keys(rowsRaw[0] || {}).map(normalizeHeader);
    const normRows = rowsRaw.map((r: any) => {
      const o: any = {};
      Object.keys(r || {}).forEach((k, i) => (o[headers[i]] = r[k]));
      return o;
    });

    // Cache branches by name → id
    const branchesByName = new Map<string, string>();
    if (defaultBranchId) {
      branchesByName.set('__DEFAULT__', defaultBranchId);
    }

    async function ensureBranchId(name: string | null | undefined): Promise<string | null> {
      const nm = (name || '').toString().trim();
      if (!nm && defaultBranchId) return defaultBranchId;
      if (!nm) return null;
      const key = nm.toLowerCase();
      if (branchesByName.has(key)) return branchesByName.get(key)!;
      // Lookup
      const { data } = await sb
        .from('branches')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('name', nm)
        .maybeSingle();
      if (data?.id) {
        branchesByName.set(key, data.id);
        return data.id as string;
      }
      if (createBranches) {
        const { data: created } = await sb
          .from('branches')
          .insert({ tenant_id: tenantId, name: nm })
          .select('id')
          .single();
        if (created?.id) {
          branchesByName.set(key, created.id as string);
          return created.id as string;
        }
      }
      return null;
    }

    let created = 0,
      updated = 0,
      skipped = 0;
    const errors: { row: number; error: string }[] = [];

    // Process in small batches to respect RLS and rate limits
    for (let i = 0; i < normRows.length; i++) {
      const r = normRows[i];
      try {
        const name = (r['name'] || r['lead name'] || r['customer name'] || '').toString().trim();
        const phone = (r['phone'] || r['mobile'] || '').toString().trim();
        const email = (r['email'] || '').toString().trim();
        const source = (r['source'] || '').toString().trim();
        const status = (r['status'] || 'New').toString().trim();
        const capacity = Number(r['capacity'] || r['capacity kw'] || r['kw'] || 0) || null;
        const date = toISODate(r['date'] || r['lead date'] || r['created'] || null);
        const nextFollow = toISODate(r['next follow-up'] || r['next follow up'] || r['follow up'] || null);
        const branchName = (r['branch'] || r['branch name'] || '').toString();
        const branchId = await ensureBranchId(branchName || undefined);

        if (!name && !phone && !email) {
          skipped++;
          continue;
        }

        // Dedupe by phone (primary)
        let existing: any = null;
        if (phone) {
          const { data } = await sb
            .from('leads')
            .select('*')
            .eq('phone', phone)
            .limit(1)
            .maybeSingle();
          if (data) existing = data;
        }
        if (!existing && email) {
          const { data } = await sb
            .from('leads')
            .select('*')
            .eq('email', email)
            .limit(1)
            .maybeSingle();
          if (data) existing = data;
        }

        if (existing) {
          if (mode === 'skip') {
            skipped++;
            continue;
          }
          if (mode === 'update') {
            const { error } = await sb
              .from('leads')
              .update({
                name: name || existing.name,
                source: source || existing.source,
                interested_capacity_kw: capacity ?? existing.interested_capacity_kw,
                date: date || existing.date,
                next_follow_up_date: nextFollow || existing.next_follow_up_date,
                status: status || existing.status,
                branch_id: branchId ?? existing.branch_id ?? null,
              })
              .eq('id', existing.id);
            if (error) throw new Error(error.message);
            updated++;
            continue;
          }
          // mode === 'create' → create anyway
        }

        const { error } = await sb
          .from('leads')
          .insert({
            tenant_id: tenantId,
            name: name || null,
            phone: phone || null,
            email: email || null,
            source: source || null,
            interested_capacity_kw: capacity,
            date: date || new Date().toISOString().slice(0, 10),
            next_follow_up_date: nextFollow,
            status: status || 'New',
            branch_id: branchId,
          });
        if (error) throw new Error(error.message);
        created++;
      } catch (e: any) {
        errors.push({ row: i + 2, error: e?.message || String(e) }); // +2 accounts for header row and 1-indexing
      }
    }

    return NextResponse.json({ ok: true, created, updated, skipped, errors });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/leads/import', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Import failed', id, cause: String(e?.message || e) }, { status: 500 });
  }
}

