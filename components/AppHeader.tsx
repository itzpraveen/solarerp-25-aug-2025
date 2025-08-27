'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { Menu, X, Sun, Moon, Search, Plus } from 'lucide-react';
import BranchSelect from '~/components/BranchSelect';

const links = [
  { href: '/overview', label: 'Overview' },
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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [branchValue, setBranchValue] = useState<string | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

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
      // Initialize tenant and saved branch
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      const tId = (prof as any)?.tenant_id as string | undefined;
      if (tId) {
        setTenantId(tId);
        try {
          const saved = localStorage.getItem(`pref:branch:${tId}`) as
            | string
            | null;
          if (saved) setBranchValue(saved as any);
        } catch {}
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
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      const initial = stored || (prefersDark ? 'dark' : 'light');
      setTheme(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    } catch {}
    try {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
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
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden"
            aria-label="Toggle Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/overview" className="font-semibold hover:opacity-90">
            SolarERP
          </Link>
        </div>
        <nav className="hidden gap-1 md:flex overflow-x-auto">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  'text-sm rounded-md px-2 py-1 transition-colors whitespace-nowrap ' +
                  (active
                    ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            aria-label="Open search"
            onClick={() => window.dispatchEvent(new Event('open-cmdk'))}
            className="hidden rounded-md border px-2 py-1 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 sm:flex items-center gap-1"
            title="Search (Ctrl/Cmd+K)"
          >
            <Search size={16} />
            <span className="hidden md:inline">Search</span>
            <span className="ml-1 hidden items-center gap-0.5 rounded border px-1 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400 md:inline-flex">
              {isMac ? '⌘ K' : 'Ctrl K'}
            </span>
          </button>
          <div className="relative hidden sm:block">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((v) => !v)}
              className="rounded-md border px-2 py-1 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 flex items-center gap-1"
              title="Create"
            >
              <Plus size={16} />
              <span className="hidden md:inline">Create</span>
            </button>
            {createOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                {[
                  { label: 'Lead', href: '/leads' },
                  { label: 'Customer', href: '/customers' },
                  { label: 'Job', href: '/jobs' },
                  { label: 'Proposal', href: '/proposals/new' },
                ].map((it) => (
                  <a
                    key={it.label}
                    role="menuitem"
                    href={it.href}
                    onClick={() => setCreateOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    New {it.label}
                  </a>
                ))}
              </div>
            )}
          </div>
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
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                onClick={() => setUserOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-sm font-semibold uppercase text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                title={email || 'Account'}
              >
                {String(email).charAt(0)}
              </button>
              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded border bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="px-2 py-1 text-xs text-gray-500">Signed in</div>
                  <div className="truncate px-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
                    {email}
                    {role ? (
                      <span className="ml-1 text-xs text-gray-500">• {role}</span>
                    ) : null}
                  </div>
                  <button
                    onClick={signOut}
                    className="w-full rounded border px-2 py-1 text-left text-sm dark:border-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded border px-2 py-1 dark:border-gray-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      {open && (
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <div className="flex flex-wrap gap-3">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    'text-sm rounded-md px-2 py-1 ' +
                    (active
                      ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')
                  }
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              );
            })}
            <button
              className="rounded border px-2 py-1 text-sm"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event('open-cmdk'));
              }}
            >
              Search…
            </button>
            <Link
              href="/proposals/new"
              className="rounded border px-2 py-1 text-sm"
              onClick={() => setOpen(false)}
            >
              New Proposal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
