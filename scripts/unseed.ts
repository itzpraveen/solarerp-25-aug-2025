import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function arg(name: string) {
  const ix = process.argv.findIndex((a) => a === `--${name}`);
  return ix >= 0 ? process.argv[ix + 1] : undefined;
}

async function resolveTenantId(
  supabase: ReturnType<typeof createClient>,
  id?: string | null,
  name?: string | null,
) {
  if (id && id.trim()) return id.trim();
  if (name && name.trim()) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .ilike('name', name.trim())
      .limit(2);
    if (error)
      throw new Error(`Failed to lookup tenant by name: ${error.message}`);
    if (!data || data.length === 0)
      throw new Error(`No tenant found matching name: ${name}`);
    if (data.length > 1)
      throw new Error(
        `Multiple tenants match name '${name}'. Please specify SEED_TENANT_ID.`,
      );
    return data[0].id as string;
  }
  throw new Error(
    'Provide SEED_TENANT_ID or SEED_TENANT_NAME (or --tenant/--name).',
  );
}

async function listAllObjects(
  supabase: ReturnType<typeof createClient>,
  prefix: string,
) {
  const out: string[] = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from('documents')
      .list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      } as any);
    if (error) throw error;
    const batch = (data || []).map((f) => `${prefix}/${f.name}`);
    out.push(...batch);
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const TENANT_ID_ENV = process.env.SEED_TENANT_ID || arg('tenant');
  const TENANT_NAME_ENV = process.env.SEED_TENANT_NAME || arg('name');
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key);
  const TENANT_ID = await resolveTenantId(
    supabase,
    TENANT_ID_ENV || null,
    TENANT_NAME_ENV || null,
  );

  // Best-effort: remove Storage objects under tenant prefix (documents bucket)
  try {
    const keys = await listAllObjects(supabase, TENANT_ID);
    if (keys.length) {
      // Remove in chunks of 100 to avoid payload size issues
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        const { error: remErr } = await supabase.storage
          .from('documents')
          .remove(chunk);
        if (remErr) console.warn('storage remove warning:', remErr.message);
      }
    }
  } catch (e: any) {
    console.warn('storage cleanup warning:', e?.message || e);
  }

  // Delete tenant row (will cascade to all tenant-owned rows by FK)
  const { error: delErr } = await supabase
    .from('tenants')
    .delete()
    .eq('id', TENANT_ID);
  if (delErr)
    throw new Error(`Failed to delete tenant ${TENANT_ID}: ${delErr.message}`);
  console.log('Deleted tenant and related data for', TENANT_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
