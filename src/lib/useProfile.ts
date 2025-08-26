"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export type Role = 'owner' | 'admin' | 'manager' | 'sales' | 'technician' | 'accountant' | 'viewer' | 'staff';
export type Profile = { tenant_id: string; role: Role; display_name?: string | null };

export function useProfile() {
  const supabase = supabaseBrowser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('tenant_id, role, display_name').maybeSingle();
      setProfile((data as any) || null);
      setLoading(false);
    })();
  }, []);

  return { profile, loading };
}
