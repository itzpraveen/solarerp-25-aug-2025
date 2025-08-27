import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function listAllUsers(admin: any) {
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;
  // Supabase v2 paginates users
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage });
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function listAllKeys(sb: any, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const current = stack.pop()!;
    const { data, error } = await sb.storage
      .from('documents')
      .list(current || undefined, { limit: 1000, offset: 0 } as any);
    if (error) throw error;
    for (const entry of data || []) {
      const p = current ? `${current}/${entry.name}` : entry.name;
      if (
        (entry as any).id === undefined &&
        (entry as any).updated_at === undefined &&
        !entry.metadata
      ) {
        // folder-like
        stack.push(p);
      } else {
        out.push(p);
      }
    }
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key)
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );

  const sure =
    process.argv.includes('--i-am-sure') || process.env.I_AM_SURE === '1';
  if (!sure) {
    console.error('Refusing to reset. Re-run with --i-am-sure or I_AM_SURE=1');
    process.exit(2);
  }

  const keepUsers = process.argv.includes('--keep-users');
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // 1) Storage: delete all objects in documents bucket
  try {
    const keys = await listAllKeys(admin, '');
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      if (chunk.length) await admin.storage.from('documents').remove(chunk);
    }
    console.log(`Storage: removed ${keys.length} objects from documents/`);
  } catch (e: any) {
    console.warn('Storage cleanup warning:', e?.message || e);
  }

  // 2) Tables: delete from profiles then tenants (cascades)
  try {
    await admin.from('profiles').delete().neq('user_id', '');
  } catch {}
  const { error: delTenErr } = await admin
    .from('tenants')
    .delete()
    .neq('id', '');
  if (delTenErr) console.warn('Tenants cleanup warning:', delTenErr.message);

  // 3) (Optional) Auth users
  if (!keepUsers) {
    try {
      const users = await listAllUsers(admin);
      for (const u of users) {
        try {
          await (admin as any).auth.admin.deleteUser(u.id);
        } catch (e) {
          console.warn('deleteUser warning:', (e as any)?.message || e);
        }
      }
      console.log(`Auth: removed ${users.length} user(s)`);
    } catch (e: any) {
      console.warn('Auth cleanup warning:', e?.message || e);
    }
  }

  console.log(
    'All data cleared. You can now sign in and create a fresh tenant.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
