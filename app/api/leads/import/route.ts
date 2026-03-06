import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import ExcelJS from 'exceljs';
import { selectMyProfile } from '@/lib/currentProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ImportMode = 'create' | 'skip' | 'update';

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function onlyDigits(s: string) {
  return s.replace(/\D+/g, '');
}

function normalizePhone(v: any): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  let s = String(v).trim();
  // Convert scientific notation like 9.04E9
  if (/^\d+\.\d+e\+?\d+$/i.test(s)) s = String(Number(s));
  s = onlyDigits(s);
  // Keep last 10–12 digits if too long
  if (s.length > 12) s = s.slice(-12);
  return s;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(
  s: string | number | Date | null | undefined,
): string | null {
  if (!s) return null;
  try {
    if (s instanceof Date) {
      if (!isNaN(s.getTime())) return s.toISOString().slice(0, 10);
      return null;
    }
    if (typeof s === 'number') {
      const d = excelSerialToDate(s);
      if (d) return d.toISOString().slice(0, 10);
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
    // Try leading DD/MM without year inside free text (use current year)
    const m2 = t.match(/^(\d{1,2})[\/-](\d{1,2})\b/);
    if (m2) {
      const dd = parseInt(m2[1], 10);
      const mm = parseInt(m2[2], 10);
      const yyyy = new Date().getFullYear();
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
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    // After the guard above, treat client as non-null for nested helpers
    const s = sb as any;

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file)
      return NextResponse.json(
        { ok: false, error: 'Missing file' },
        { status: 400 },
      );
    // Basic safeguards: size/type checks before reading into memory
    const maxBytes = Number(process.env.LEADS_IMPORT_MAX_BYTES || 2 * 1024 * 1024); // 2MB default
    if (typeof file.size === 'number' && file.size > maxBytes) {
      return NextResponse.json(
        { ok: false, error: `File too large (max ${maxBytes} bytes)` },
        { status: 413 },
      );
    }
    const ct = (file as any)?.type || '';
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (ct && !allowed.includes(ct)) {
      return NextResponse.json(
        { ok: false, error: 'Unsupported content type' },
        { status: 415 },
      );
    }
    const mode = (form.get('mode') as ImportMode) || 'create';
    const defaultBranchId = (form.get('branchId') as string) || '';
    const createBranches =
      String(form.get('createBranches') || 'false') === 'true';

    // Determine tenant
    const { profile: prof } = await selectMyProfile(s, 'tenant_id');
    const tenantId = (prof as any)?.tenant_id as string | undefined;
    if (!tenantId)
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );

    // Read workbook
    const buffer = Buffer.from(
      await file.arrayBuffer(),
    ) as unknown as Buffer;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws)
      return NextResponse.json(
        { ok: false, error: 'No rows found' },
        { status: 400 },
      );

    let headers: string[] = [];
    const normRows: any[] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (rowNumber === 1) {
        headers = values.map((v) => normalizeHeader(String(v || '')));
        return;
      }
      if (!headers.length) return;
      const o: any = {};
      for (let i = 0; i < headers.length; i++) {
        o[headers[i]] = values[i] ?? '';
      }
      normRows.push(o);
    });
    if (!normRows.length)
      return NextResponse.json(
        { ok: false, error: 'No rows found' },
        { status: 400 },
      );

    // Cache branches by name → id
    const branchesByName = new Map<string, string>();
    if (defaultBranchId) {
      branchesByName.set('__DEFAULT__', defaultBranchId);
    }

    async function ensureBranchId(
      name: string | null | undefined,
    ): Promise<string | null> {
      const nm = (name || '').toString().trim();
      if (!nm && defaultBranchId) return defaultBranchId;
      if (!nm) return null;
      const key = nm.toLowerCase();
      if (branchesByName.has(key)) return branchesByName.get(key)!;
      // Lookup
      const { data } = await s
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
        const { data: created } = await s
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
        const name = (r['name'] || r['lead name'] || r['customer name'] || '')
          .toString()
          .trim();
        const phoneRaw =
          r['phone'] ??
          r['mobile'] ??
          r['contact number'] ??
          r['contact no'] ??
          r['contact'] ??
          '';
        const phone = normalizePhone(phoneRaw);
        const email = (r['email'] || '').toString().trim();
        const source = (r['source'] || '').toString().trim();
        const status = (r['status'] || '').toString().trim() || 'New';
        // Capacity may be free text like "3kw hybrid"; extract first number
        const capacityText = (
          r['capacity'] ??
          r['capacity kw'] ??
          r['kw'] ??
          ''
        ).toString();
        const capMatch = capacityText.match(/(\d+(?:\.\d+)?)/);
        const capacity = capMatch ? Number(capMatch[1]) : null;
        const date = toISODate(
          r['date'] || r['lead date'] || r['created'] || null,
        );
        const nextFollow = toISODate(
          r['next follow-up'] ||
            r['next follow up'] ||
            r['follow up'] ||
            r['followup'] ||
            r['remarks'] ||
            null,
        );
        const branchName = (r['branch'] || r['branch name'] || '').toString();
        const address =
          (r['address'] || r['place'] || '').toString().trim() || null;
        const remarks = (
          r['remarks'] ||
          r['quatation'] ||
          r['quatatation'] ||
          r['site visit'] ||
          ''
        )
          .toString()
          .trim();
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
                interested_capacity_kw:
                  capacity ?? existing.interested_capacity_kw,
                date: date || existing.date,
                next_follow_up_date: nextFollow || existing.next_follow_up_date,
                status: status || existing.status,
                branch_id: branchId ?? existing.branch_id ?? null,
                address: address || existing.address || null,
                notes: remarks
                  ? existing.notes
                    ? `${existing.notes}\n${remarks}`
                    : remarks
                  : (existing.notes ?? null),
              })
              .eq('id', existing.id);
            if (error) throw new Error(error.message);
            updated++;
            continue;
          }
          // mode === 'create' → create anyway
        }

        const { error } = await sb.from('leads').insert({
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
          address,
          notes: remarks || null,
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
    return NextResponse.json(
      { ok: false, error: 'Import failed', id, cause: String(e?.message || e) },
      { status: 500 },
    );
  }
}
