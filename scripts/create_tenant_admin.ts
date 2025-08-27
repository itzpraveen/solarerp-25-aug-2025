import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getArg(key: string, def?: string) {
  const pref = `--${key}=`;
  const arg = process.argv.find((a) => a.startsWith(pref));
  if (arg) return arg.slice(pref.length);
  return def;
}

async function main() {
  const email = getArg('email');
  const name = getArg('name', 'My Company');
  const role = (getArg('role', 'admin') as 'admin' | 'owner') || 'admin';
  if (!email)
    throw new Error(
      'Usage: tsx scripts/create_tenant_admin.ts --email=user@example.com [--name=Tenant Name] [--role=admin]',
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key)
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // 1) Create tenant
  const { data: t, error: tErr } = await admin
    .from('tenants')
    .insert({ name })
    .select('id')
    .single();
  if (tErr) throw tErr;
  const tenantId = (t as any).id as string;

  // 2) Ensure settings row
  await admin
    .from('settings')
    .insert({ tenant_id: tenantId, currency: 'INR', default_tax_rate: 0 })
    .then(() => null)
    .catch(() => null);

  // 3) Ensure auth user exists
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
  if (!userId) throw new Error('Unable to ensure user for email: ' + email);

  // 4) Upsert profile as admin
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({
      user_id: userId,
      tenant_id: tenantId,
      role,
      display_name: email.split('@')[0],
    })
    .eq('user_id', userId);
  if (pErr) throw pErr;

  console.log(
    `Created tenant '${name}' (${tenantId}) and granted ${role} to ${email} (user ${userId}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
