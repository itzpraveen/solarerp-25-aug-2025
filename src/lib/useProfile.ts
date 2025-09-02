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
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function invalidateProfileCache() {
  cachedProfile = undefined;
  inflight = null;
  cachedAt = 0;
}

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
    const fresh = cachedProfile !== undefined && Date.now() - cachedAt < TTL_MS;
    if (fresh) {
      setLoading(false);
      setProfile((cachedProfile as Profile | null) ?? null);
      return;
    }
    if (!inflight) inflight = loadOnce();
    inflight
      .then((p) => {
        if (!alive) return;
        cachedProfile = p;
        cachedAt = Date.now();
        setProfile(p);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    // Setup auth change listener once to invalidate cache
    try {
      const supabase = supabaseBrowser();
      // Avoid accumulating listeners: rely on window singleton flag
      const flag = '__profile_auth_listener__';
      // @ts-ignore
      if (typeof window !== 'undefined' && !(window as any)[flag]) {
        // @ts-ignore
        (window as any)[flag] = true;
        supabase.auth.onAuthStateChange(() => {
          invalidateProfileCache();
        });
      }
    } catch {}
    return () => {
      alive = false;
    };
  }, []);

  return { profile, loading };
}

// Allow components to force-refresh the profile cache (e.g., after role changes)
export async function refreshProfile(): Promise<Profile | null> {
  invalidateProfileCache();
  const p = await loadOnce();
  cachedProfile = p;
  cachedAt = Date.now();
  return p;
}
