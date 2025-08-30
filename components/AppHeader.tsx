'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { Menu, X, Sun, Moon, Search, Plus, Bell } from 'lucide-react';
import BranchSelect from '~/components/BranchSelect';

const links = [
  { href: '/overview', label: 'Overview' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/proposals', label: 'Proposals' },
  // Clarify that this page lists CRM leads (not pipeline status)
  { href: '/leads', label: 'Leads (CRM)' },
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [dueLeadsCount, setDueLeadsCount] = useState(0);
  const [overdueInvCount, setOverdueInvCount] = useState(0);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      const uid = data.user?.id;
      setAuthed(!!uid);
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', uid)
          .single();
        setRole((prof as any)?.role ?? null);
      } else {
        setRole(null);
      }
      // Initialize tenant and saved branch
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', uid)
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
      }
    });
  }, []);

  // Lightweight notifications: leads due today + overdue invoices
  useEffect(() => {
    (async () => {
      if (!authed) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        let lq = supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('next_follow_up_date', today)
          .neq('status', 'Closed')
          .neq('status', 'Converted')
          .neq('status', 'Lost');
        if (branchValue !== 'all')
          lq = lq.eq('branch_id', branchValue as string);
        const { count: c1 } = await lq;
        setDueLeadsCount(c1 || 0);

        // Overdue invoices: scope by selected branch when not 'all'
        if (branchValue === 'all') {
          const { count: c2 } = await supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .lt('due_date', today)
            .neq('status', 'Paid');
          setOverdueInvCount(c2 || 0);
        } else {
          // Restrict to invoices of jobs that belong to the selected branch
          const { data: branchJobs } = await supabase
            .from('jobs')
            .select('id')
            .eq('branch_id', branchValue as string)
            .limit(1000);
          const jobIds = ((branchJobs as any[]) || []).map((r) => r.id);
          if (jobIds.length === 0) {
            setOverdueInvCount(0);
          } else {
            const { count: c2 } = await supabase
              .from('invoices')
              .select('id', { count: 'exact', head: true })
              .in('job_id', jobIds as any)
              .lt('due_date', today)
              .neq('status', 'Paid');
            setOverdueInvCount(c2 || 0);
          }
        }
      } catch {}
    })();
  }, [branchValue, authed]);

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
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-md border px-2 py-1 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Notifications"
            >
              <Bell size={16} />
              {dueLeadsCount + overdueInvCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">
                  {Math.min(99, dueLeadsCount + overdueInvCount)}
                </span>
              )}
            </button>
            {notifOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 rounded border bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between px-2 py-1 text-sm">
                  <span
                    className="text-gray-700 dark:text-gray-200"
                    title="Open leads with follow-ups due today"
                  >
                    Follow-ups due today
                  </span>
                  <span
                    className={
                      dueLeadsCount > 0 ? 'text-red-600' : 'text-gray-600'
                    }
                  >
                    {dueLeadsCount}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-sm">
                  <span className="text-gray-700 dark:text-gray-200">
                    Overdue invoices
                  </span>
                  <span
                    className={
                      overdueInvCount > 0 ? 'text-red-600' : 'text-gray-600'
                    }
                  >
                    {overdueInvCount}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 px-2">
                  <a className="text-blue-600 text-sm" href="/leads?due=today">
                    Open Leads
                  </a>
                  <a className="text-blue-600 text-sm" href="/jobs?tab=finance">
                    Finance
                  </a>
                </div>
              </div>
            )}
          </div>
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
                  {tenantId && (
                    <div className="mb-2">
                      <div className="px-2 pb-1 text-xs text-gray-500">
                        Branch
                      </div>
                      <BranchSelect
                        value={branchValue}
                        onChange={(v) => {
                          setBranchValue(v);
                          try {
                            if (tenantId)
                              localStorage.setItem(
                                `pref:branch:${tenantId}`,
                                String(v),
                              );
                          } catch {}
                          window.dispatchEvent(
                            new CustomEvent('branch-change', {
                              detail: { value: v },
                            }),
                          );
                        }}
                        includeAll
                        allLabel="All"
                      />
                    </div>
                  )}
                  <div className="px-2 py-1 text-xs text-gray-500">
                    Signed in
                  </div>
                  <div className="truncate px-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
                    {email}
                    {role ? (
                      <span className="ml-1 text-xs text-gray-500">
                        • {role}
                      </span>
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
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 h-[88vh] overflow-y-auto rounded-b-lg border-b bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950">
            <div className="mx-auto max-w-7xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Menu</div>
                <button
                  className="rounded-md border px-2 py-1 dark:border-gray-700"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Primary navigation */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {links.map((l) => {
                  const active = pathname.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={
                        'rounded-lg border px-3 py-2 text-center text-sm ' +
                        (active
                          ? 'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-900')
                      }
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
              {/* Quick actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'New Lead', href: '/leads' },
                  { label: 'New Customer', href: '/customers' },
                  { label: 'New Job', href: '/jobs' },
                  { label: 'New Proposal', href: '/proposals/new' },
                ].map((it) => (
                  <Link
                    key={it.label}
                    href={it.href}
                    className="rounded-lg border px-3 py-2 text-center text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    onClick={() => setOpen(false)}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
              {/* Notifications summary */}
              <div className="mt-3 w-full rounded-lg border p-3 text-sm dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700 dark:text-gray-200">Follow-ups today</div>
                  <div className={dueLeadsCount > 0 ? 'text-red-600' : 'text-gray-600'}>
                    {dueLeadsCount}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-gray-700 dark:text-gray-200">Overdue invoices</div>
                  <div className={overdueInvCount > 0 ? 'text-red-600' : 'text-gray-600'}>
                    {overdueInvCount}
                  </div>
                </div>
                <div className="mt-2 flex gap-3">
                  <Link
                    href="/leads?due=today"
                    className="text-blue-600"
                    onClick={() => setOpen(false)}
                  >
                    Open Leads
                  </Link>
                  <Link
                    href="/jobs?tab=finance"
                    className="text-blue-600"
                    onClick={() => setOpen(false)}
                  >
                    Finance
                  </Link>
                </div>
              </div>
              {/* Utilities */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-sm dark:border-gray-700"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new Event('open-cmdk'));
                  }}
                >
                  Search…
                </button>
                <button
                  className="rounded-lg border px-3 py-2 text-sm dark:border-gray-700"
                  onClick={() => {
                    toggleTheme();
                    setOpen(false);
                  }}
                >
                  {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  className="rounded-full border px-4 py-1 text-sm dark:border-gray-700"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
