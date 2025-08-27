'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Allow public routes
    if (
      pathname.startsWith('/auth') ||
      pathname.startsWith('/api') ||
      pathname === '/' // root redirects anyway
    ) {
      setReady(true);
      return;
    }
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/auth/signin');
      }
      setReady(true);
    });
  }, [pathname, router]);

  // Render nothing until we check auth to avoid flashes
  if (!ready) return null;
  return null;
}
