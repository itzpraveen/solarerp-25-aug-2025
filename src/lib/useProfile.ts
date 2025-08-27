'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export type Role =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'technician'
  | 'accountant'
  | 'viewer'
  | 'staff';
export type Profile = {
  tenant_id: string;
  role: Role;
  display_name?: string | null;
};

export function useProfile() {
  const supabase = supabaseBrowser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = (u?.user as any)?.id as string | undefined;
        if (!uid) {
          setProfile(null);
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('tenant_id, role, display_name')
            .eq('user_id', uid)
            .maybeSingle();
          setProfile((data as any) || null);
        }
      } catch {
        setProfile(null);
      }
      setLoading(false);
    })();
  }, []);

  return { profile, loading };
}
