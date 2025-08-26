import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type Args = {
  tenant: string | null;
  branchId: string | null;
  branchName: string | null;
  dry: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { tenant: null, branchId: null, branchName: null, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant') out.tenant = argv[++i] || null;
    else if (a === '--branch-id') out.branchId = argv[++i] || null;
    else if (a === '--branch-name') out.branchName = argv[++i] || null;
    else if (a === '--dry') out.dry = true;
  }
  return out;
}

async function ensureBranchId(supabase: any, tenantId: string, branchId: string | null, branchName: string | null): Promise<string> {
  if (branchId) return branchId;
  if (!branchName) throw new Error('Provide either --branch-id or --branch-name');
  // find or create by name under tenant
  const { data: existing } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', branchName)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from('branches')
    .insert({ tenant_id: tenantId, name: branchName })
    .select('id')
    .single();
  if (error || !created?.id) throw new Error(`Failed to create branch: ${error?.message || 'unknown error'}`);
  return created.id as string;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key);

  const args = parseArgs();
  const tenantId = args.tenant || process.env.SEED_TENANT_ID || null;
  if (!tenantId) throw new Error('Provide --tenant <uuid> or set SEED_TENANT_ID');

  const bId = await ensureBranchId(supabase, tenantId, args.branchId, args.branchName);
  console.log('Using tenant:', tenantId);
  console.log('Using branch:', bId);

  // counts
  const { count: leadNullCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('branch_id', null);
  const { count: jobNullCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('branch_id', null);

  console.log(`Leads to backfill: ${leadNullCount || 0}`);
  console.log(`Jobs to backfill:  ${jobNullCount || 0}`);

  if (args.dry) {
    console.log('Dry run: no updates performed.');
    return;
  }

  if ((leadNullCount || 0) > 0) {
    const { error } = await supabase
      .from('leads')
      .update({ branch_id: bId })
      .eq('tenant_id', tenantId)
      .is('branch_id', null);
    if (error) throw new Error(`Leads update failed: ${error.message}`);
    console.log('Leads backfill complete.');
  }

  if ((jobNullCount || 0) > 0) {
    const { error } = await supabase
      .from('jobs')
      .update({ branch_id: bId })
      .eq('tenant_id', tenantId)
      .is('branch_id', null);
    if (error) throw new Error(`Jobs update failed: ${error.message}`);
    console.log('Jobs backfill complete.');
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

