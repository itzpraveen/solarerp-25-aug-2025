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
  { href: '/calendar', label: 'Calendar' },
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
  }, [supabase]);

  // Lightweight notifications: leads due today + overdue invoices
  useEffect(() => {
    (async () => {
      if (!authed) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const leadsQ = (() => {
          let q = supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('next_follow_up_date', today)
            .neq('status', 'Closed')
            .neq('status', 'Converted')
            .neq('status', 'Lost');
          if (branchValue !== 'all') q = q.eq('branch_id', branchValue as string);
          return q;
        })();
        const invoicesQ = (() => {
          // Use an inner join to filter invoices by job branch when selected
          let q = supabase
            .from('invoices')
            .select('id, jobs!inner(branch_id)', { count: 'exact', head: true })
            .lt('due_date', today)
            .neq('status', 'Paid');
          if (branchValue !== 'all') q = q.eq('jobs.branch_id', branchValue as string);
          return q;
        })();
        const [{ count: c1 }, { count: c2 }] = await Promise.all([leadsQ, invoicesQ]);
        setDueLeadsCount(c1 || 0);
        setOverdueInvCount(c2 || 0);
      } catch {}
    })();
  }, [branchValue, authed, supabase]);

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
    <header className="sticky top-0 z-20 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--bg-surface)]/80">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
            aria-label="Toggle Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} className="text-[var(--text-primary)]" /> : <Menu size={20} className="text-[var(--text-primary)]" />}
          </button>
          <Link href="/overview" className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary-600)] transition-colors">
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
                  'text-sm rounded-lg px-3 py-1.5 transition-all duration-150 whitespace-nowrap font-medium ' +
                  (active
                    ? 'bg-[var(--primary-100)] text-[var(--primary-700)] dark:bg-[var(--primary-100)]/20 dark:text-[var(--primary-600)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]')
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            aria-label="Open search"
            onClick={() => window.dispatchEvent(new Event('open-cmdk'))}
            className="hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] transition-all duration-150 sm:flex items-center gap-1.5"
            title="Search (Ctrl/Cmd+K)"
          >
            <Search size={16} />
            <span className="hidden md:inline">Search</span>
            <span className="ml-1 hidden items-center gap-0.5 rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] md:inline-flex">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </span>
          </button>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] transition-all duration-150"
              title="Notifications"
            >
              <Bell size={16} />
              {dueLeadsCount + overdueInvCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--danger-500)] px-1 text-[10px] font-medium leading-4 text-white shadow-sm">
                  {Math.min(99, dueLeadsCount + overdueInvCount)}
                </span>
              )}
            </button>
            {notifOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]"
              >
                <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Notifications
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors">
                  <span
                    className="text-sm text-[var(--text-secondary)]"
                    title="Open leads with follow-ups due today"
                  >
                    Follow-ups due today
                  </span>
                  <span
                    className={
                      'text-sm font-medium ' + (dueLeadsCount > 0 ? 'text-[var(--danger-500)]' : 'text-[var(--text-muted)]')
                    }
                  >
                    {dueLeadsCount}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Overdue invoices
                  </span>
                  <span
                    className={
                      'text-sm font-medium ' + (overdueInvCount > 0 ? 'text-[var(--danger-500)]' : 'text-[var(--text-muted)]')
                    }
                  >
                    {overdueInvCount}
                  </span>
                </div>
                <div className="mt-1 border-t border-[var(--border-subtle)] pt-1">
                  <a className="block px-3 py-2 text-sm text-[var(--primary-600)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors" href="/leads?due=today">
                    View Leads
                  </a>
                  <a className="block px-3 py-2 text-sm text-[var(--primary-600)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors" href="/jobs?tab=finance">
                    View Finance
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
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] transition-all duration-150 flex items-center gap-1.5"
              title="Create"
            >
              <Plus size={16} />
              <span className="hidden md:inline">Create</span>
            </button>
            {createOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]"
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
                    className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
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
            className="hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] transition-all duration-150 sm:block"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {email ? (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                onClick={() => setUserOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] text-sm font-semibold uppercase text-white shadow-sm hover:shadow-md transition-all duration-150 ring-2 ring-[var(--bg-surface)] ring-offset-0"
                title={email || 'Account'}
              >
                {String(email).charAt(0)}
              </button>
              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]"
                >
                  {tenantId && (
                    <div className="mb-1 px-2 py-2">
                      <div className="pb-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
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
                  <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                    <div className="text-xs font-medium text-[var(--text-muted)]">
                      Signed in as
                    </div>
                    <div className="truncate text-sm font-medium text-[var(--text-primary)] mt-0.5">
                      {email}
                    </div>
                    {role && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)]">
                        {role}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-[var(--border-subtle)] pt-1 mt-1">
                    <button
                      onClick={signOut}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger-600)] transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] transition-all duration-150"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 max-h-[90vh] overflow-y-auto rounded-b-2xl border-b border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
            <div className="mx-auto max-w-7xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[var(--text-primary)]">Menu</div>
                <button
                  className="rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Primary navigation */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {links.map((l) => {
                  const active = pathname.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={
                        'rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-all ' +
                        (active
                          ? 'border-[var(--primary-500)] bg-[var(--primary-100)] text-[var(--primary-700)] dark:bg-[var(--primary-100)]/20 dark:text-[var(--primary-600)]'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]')
                      }
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
              {/* Quick actions */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2 px-1">Quick Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'New Lead', href: '/leads' },
                    { label: 'New Customer', href: '/customers' },
                    { label: 'New Job', href: '/jobs' },
                    { label: 'New Proposal', href: '/proposals/new' },
                  ].map((it) => (
                    <Link
                      key={it.label}
                      href={it.href}
                      className="rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-center text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] transition-all"
                      onClick={() => setOpen(false)}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
              {/* Notifications summary */}
              <div className="mt-4 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[var(--text-secondary)]">Follow-ups today</div>
                  <div className={'font-medium ' + (dueLeadsCount > 0 ? 'text-[var(--danger-500)]' : 'text-[var(--text-muted)]')}>
                    {dueLeadsCount}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[var(--text-secondary)]">Overdue invoices</div>
                  <div className={'font-medium ' + (overdueInvCount > 0 ? 'text-[var(--danger-500)]' : 'text-[var(--text-muted)]')}>
                    {overdueInvCount}
                  </div>
                </div>
                <div className="mt-3 flex gap-3 pt-2 border-t border-[var(--border-subtle)]">
                  <Link
                    href="/leads?due=today"
                    className="text-[var(--primary-600)] font-medium"
                    onClick={() => setOpen(false)}
                  >
                    Open Leads
                  </Link>
                  <Link
                    href="/jobs?tab=finance"
                    className="text-[var(--primary-600)] font-medium"
                    onClick={() => setOpen(false)}
                  >
                    Finance
                  </Link>
                </div>
              </div>
              {/* Utilities */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new Event('open-cmdk'));
                  }}
                >
                  <Search size={16} />
                  Search
                </button>
                <button
                  className="rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    toggleTheme();
                    setOpen(false);
                  }}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
              </div>
              <div className="mt-5 flex justify-center">
                <button
                  className="rounded-full bg-[var(--bg-subtle)] px-6 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--border-default)] transition-colors"
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
