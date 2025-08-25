"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { Menu, X, Sun } from 'lucide-react';

const links = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/proposals', label: 'Proposals' },
  { href: '/leads', label: 'Leads' },
  { href: '/kits', label: 'Kits' },
  { href: '/items', label: 'Items' },
  { href: '/service', label: 'Service' },
  { href: '/settings', label: 'Settings' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  // Keep nav simple and predictable: always show links in header
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/signin';
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden" aria-label="Toggle Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="font-semibold">SolarERP</div>
        </div>
        <nav className="hidden gap-4 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`text-sm ${pathname.startsWith(l.href) ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {/* Theme placeholder */}
          <Sun size={18} className="text-gray-600 hidden sm:block" />
          {email ? (
            <>
              <span className="hidden sm:inline text-gray-600">{email}</span>
              <button onClick={signOut} className="rounded border px-2 py-1">Sign out</button>
            </>
          ) : (
            <Link href="/auth/signin" className="rounded border px-2 py-1">Sign in</Link>
          )}
        </div>
      </div>
      {open && (
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`text-sm ${pathname.startsWith(l.href) ? 'text-blue-700 font-medium' : 'text-gray-700'}`} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
