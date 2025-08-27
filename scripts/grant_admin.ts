import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type Args = { email?: string; role?: 'owner' | 'admin'; tenant?: string };

function parseArgs(): Args {
  const a: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const [k, v] = process.argv[i].split('=');
    if (k === '--email') a.email = v;
    if (k === '--role') a.role = (v as any) || 'admin';
    if (k === '--tenant') a.tenant = v;
  }
  return a;
}

async function main() {
  const { email, role, tenant } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key)
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  if (!email)
    throw new Error(
      'Usage: npm run grant:admin -- --email=user@example.com [--role=owner|admin] [--tenant=<uuid>]',
    );
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Resolve user
  let userId: string | null = null;
  try {
    const { data: list } = await (admin as any).auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const found = list?.users?.find(
      (u: any) => String(u?.email).toLowerCase() === email.toLowerCase(),
    );
    userId = found?.id || null;
  } catch {}
  if (!userId) {
    const { data: created } = await (admin as any).auth.admin.createUser({
      email,
      email_confirm: true,
    });
    userId = created?.user?.id || null;
  }
  if (!userId)
    throw new Error('Unable to resolve or create user for email: ' + email);

  // Resolve tenant
  let tenantId =
    tenant || process.env.TENANT || process.env.SEED_TENANT_ID || '';
  if (!tenantId) {
    const { data: ts } = await admin.from('tenants').select('id, name');
    const rows = (ts as any[]) || [];
    if (rows.length === 1) tenantId = rows[0].id as string;
    else {
      console.log(
        'Tenants in this project:\n' +
          rows.map((r) => `${r.id}  ${r.name}`).join('\n'),
      );
      throw new Error('Specify tenant via --tenant=<uuid> (or TENANT env).');
    }
  }

  const targetRole = (role || 'admin') as 'owner' | 'admin';
  const { error } = await admin
    .from('profiles')
    .upsert({
      user_id: userId,
      tenant_id: tenantId,
      role: targetRole,
      display_name: email.split('@')[0],
    })
    .eq('user_id', userId);
  if (error) throw error;
  console.log(
    `Granted ${targetRole} to ${email} in tenant ${tenantId} (user ${userId}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
