import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const TENANT_ID = process.env.SEED_TENANT_ID;
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');
  if (!TENANT_ID) throw new Error('Missing env SEED_TENANT_ID (which tenant to delete)');

  const supabase = createClient(url, key);

  // Best-effort: remove Storage objects under tenant prefix
  try {
    const { data: files, error: listErr } = await supabase.storage.from('documents').list(TENANT_ID, { limit: 1000 });
    if (listErr) {
      console.warn('storage list warning:', listErr.message);
    } else if (files && files.length) {
      const keys = files.map((f) => `${TENANT_ID}/${f.name}`);
      const { error: remErr } = await supabase.storage.from('documents').remove(keys);
      if (remErr) console.warn('storage remove warning:', remErr.message);
    }
  } catch (e: any) {
    console.warn('storage cleanup error:', e?.message || e);
  }

  // Delete tenant row (will cascade to all tenant-owned rows by FK)
  const { error: delErr } = await supabase.from('tenants').delete().eq('id', TENANT_ID);
  if (delErr) throw new Error(`Failed to delete tenant ${TENANT_ID}: ${delErr.message}`);
  console.log('Deleted tenant and related data for', TENANT_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

