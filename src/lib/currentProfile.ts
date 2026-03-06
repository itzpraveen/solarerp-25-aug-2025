import type { SupabaseClient } from '@supabase/supabase-js';

export async function getCurrentUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function getCurrentProfile<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns = 'tenant_id, role, display_name',
): Promise<{ userId: string | null; profile: T | null }> {
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return { userId: null, profile: null };
  }

  const { data, error } = await (supabase.from('profiles') as any)
    .select(columns)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    userId,
    profile: ((data as T | null) ?? null) as T | null,
  };
}

export async function selectMyProfile<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns = 'tenant_id, role, display_name',
) {
  return getCurrentProfile<T>(supabase, columns);
}
