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

// Simple module-level cache to avoid N identical profile queries in list rows
let cachedProfile: Profile | null | undefined = undefined; // undefined = not loaded yet; null = loaded but none
let inflight: Promise<Profile | null> | null = null;

async function loadOnce(): Promise<Profile | null> {
  const supabase = supabaseBrowser();
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = (u?.user as any)?.id as string | undefined;
    if (!uid) return null;
    const { data } = await supabase
      .from('profiles')
      .select('tenant_id, role, display_name')
      .eq('user_id', uid)
      .maybeSingle();
    return ((data as any) || null) as Profile | null;
  } catch {
    return null;
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(
    cachedProfile === undefined ? null : cachedProfile,
  );
  const [loading, setLoading] = useState(cachedProfile === undefined);

  useEffect(() => {
    let alive = true;
    if (cachedProfile !== undefined) {
      setLoading(false);
      setProfile(cachedProfile);
      return;
    }
    if (!inflight) inflight = loadOnce();
    inflight
      .then((p) => {
        if (!alive) return;
        cachedProfile = p;
        setProfile(p);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { profile, loading };
}
