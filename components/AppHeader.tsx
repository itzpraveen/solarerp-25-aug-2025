"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';

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
  const [role, setRole] = useState<string | null>(null);
  // Keep nav simple and predictable: always show links in header
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', data.user.id)
          .single();
        setRole((prof as any)?.role ?? null);
      } else {
        setRole(null);
      }
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/signin';
  };

  useEffect(() => {
    // Initialize theme from storage or system
    try {
      const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = stored || (prefersDark ? 'dark' : 'light');
      setTheme(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden" aria-label="Toggle Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/jobs" className="font-semibold hover:opacity-90">SolarERP</Link>
        </div>
        <nav className="hidden gap-4 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                pathname.startsWith(l.href)
                  ? 'font-medium text-blue-700 dark:text-blue-400'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="hidden rounded-md border px-2 py-1 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 sm:block"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {email ? (
            <>
              <span className="hidden sm:inline text-gray-600 dark:text-gray-300">{email}{role ? ` • ${String(role).charAt(0).toUpperCase()}${String(role).slice(1)}` : ''}</span>
              <button onClick={signOut} className="rounded border px-2 py-1 dark:border-gray-700">Sign out</button>
            </>
          ) : (
            <Link href="/auth/signin" className="rounded border px-2 py-1 dark:border-gray-700">Sign in</Link>
          )}
        </div>
      </div>
      {open && (
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${
                  pathname.startsWith(l.href)
                    ? 'font-medium text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
