"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export type Profile = { tenant_id: string; role: 'owner' | 'staff'; display_name?: string | null };

export function useProfile() {
  const supabase = supabaseBrowser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('tenant_id, role, display_name').single();
      setProfile((data as any) || null);
      setLoading(false);
    })();
  }, []);

  return { profile, loading };
}

