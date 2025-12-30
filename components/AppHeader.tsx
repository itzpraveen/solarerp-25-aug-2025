'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Menu, X, Sun, Moon, Search, Plus, Bell, ChevronDown } from 'lucide-react';
import BranchSelect from '~/components/BranchSelect';
import { useProfile } from '@/lib/useProfile';
import { useBranchSelection } from '@/lib/useBranchSelection';

type NavLink = {
  href: string;
  label: string;
  tag?: string;
};

const primaryLinks: NavLink[] = [
  { href: '/overview', label: 'Overview' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/proposals', label: 'Proposals' },
  // Clarify that this page lists CRM leads (not pipeline status)
  { href: '/leads', label: 'Leads', tag: 'CRM' },
];

const overflowLinks: NavLink[] = [
  { href: '/calendar', label: 'Calendar' },
  { href: '/kits', label: 'Kits' },
  { href: '/items', label: 'Items' },
  { href: '/service', label: 'Service' },
];

const mobileLinks = [...primaryLinks, ...overflowLinks];

const SIGNED_LOGO_TTL_MS = 6 * 24 * 60 * 60 * 1000;

type BrandCache = {
  cachedAt: number;
  name: string | null;
  rawLogo: string | null;
  resolvedLogo: string | null;
  resolvedAt: number | null;
  usesSigned: boolean;
};

function NavLabel({
  label,
  tag,
  compact = false,
}: {
  label: string;
  tag?: string;
  compact?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      {tag && (
        <span
          className={
            'rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-semibold uppercase tracking-wide ' +
            (compact ? 'text-[9px] text-[var(--text-tertiary)]' : 'text-[10px] text-[var(--text-tertiary)]')
          }
        >
          {tag}
        </span>
      )}
    </span>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  // Keep nav simple and predictable: always show links in header
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dueLeadsCount, setDueLeadsCount] = useState(0);
  const [overdueInvCount, setOverdueInvCount] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { profile } = useProfile();
  const { branchId, setBranchId } = useBranchSelection();
  const role = profile?.role ?? null;
  const tenantId = profile?.tenant_id ?? null;

  useEffect(() => {
    let alive = true;
    const applySession = (session: { user?: { id?: string; email?: string } } | null) => {
      if (!alive) return;
      const user = session?.user;
      setEmail(user?.email ?? null);
      setAuthed(!!user?.id);
    };
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session as any));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session as any);
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
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
          if (branchId !== 'all') q = q.eq('branch_id', branchId as string);
          return q;
        })();
        const invoicesQ = (() => {
          // Use an inner join to filter invoices by job branch when selected
          let q = supabase
            .from('invoices')
            .select('id, jobs!inner(branch_id)', { count: 'exact', head: true })
            .lt('due_date', today)
            .neq('status', 'Paid');
          if (branchId !== 'all') q = q.eq('jobs.branch_id', branchId as string);
          return q;
        })();
        const [{ count: c1 }, { count: c2 }] = await Promise.all([leadsQ, invoicesQ]);
        setDueLeadsCount(c1 || 0);
        setOverdueInvCount(c2 || 0);
      } catch {}
    })();
  }, [branchId, authed, supabase]);

  useEffect(() => {
    let alive = true;
    if (!tenantId) {
      setCompanyLogoUrl(null);
      setCompanyName(null);
      setLogoError(false);
      setLogoLoading(false);
      setLogoLoaded(false);
      return;
    }
    setLogoLoading(true);
    const cacheKey = `settings:brand:${tenantId}`;
    const now = Date.now();
    let cache: BrandCache | null = null;

    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) cache = JSON.parse(cachedRaw) as BrandCache;
    } catch {}

    if (cache) {
      if (cache.name) setCompanyName(cache.name);
      if (cache.resolvedLogo) {
        const signedValid =
          !cache.usesSigned ||
          (cache.resolvedAt && now - cache.resolvedAt < SIGNED_LOGO_TTL_MS);
        if (signedValid) {
          setCompanyLogoUrl(cache.resolvedLogo);
          setLogoError(false);
        }
      }
      if (cache.name || cache.resolvedLogo) setLogoLoading(false);
    }

    (async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('company_logo_url, company_name')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!alive) return;
        const name = (data?.company_name || '').trim() || null;
        const rawLogo = (data?.company_logo_url || '').trim() || null;
        let resolvedLogo: string | null = null;
        let usesSigned = false;

        if (rawLogo) {
          if (/^https?:\/\//i.test(rawLogo) || /^data:/i.test(rawLogo)) {
            resolvedLogo = rawLogo;
          } else {
            const cacheValid =
              cache?.rawLogo === rawLogo &&
              cache?.resolvedLogo &&
              cache?.usesSigned &&
              cache?.resolvedAt &&
              now - cache.resolvedAt < SIGNED_LOGO_TTL_MS;
            const cachedResolved = cache?.resolvedLogo || null;
            if (cacheValid && cachedResolved) {
              resolvedLogo = cachedResolved;
              usesSigned = true;
            } else {
              try {
                const { data: signed } = await supabase.storage
                  .from('documents')
                  .createSignedUrl(rawLogo, 60 * 60 * 24 * 7);
                if ((signed as any)?.signedUrl) {
                  resolvedLogo = (signed as any).signedUrl as string;
                  usesSigned = true;
                }
              } catch {}
            }
          }
        }

        setCompanyName(name);
        setCompanyLogoUrl(resolvedLogo);
        setLogoError(false);
        setLogoLoading(false);

        try {
          const nextCache: BrandCache = {
            cachedAt: Date.now(),
            name,
            rawLogo,
            resolvedLogo,
            resolvedAt: resolvedLogo ? Date.now() : null,
            usesSigned,
          };
          localStorage.setItem(cacheKey, JSON.stringify(nextCache));
        } catch {}
      } catch {
        if (alive) setLogoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenantId, supabase]);

  useEffect(() => {
    if (companyLogoUrl) setLogoLoaded(false);
  }, [companyLogoUrl]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/signin';
  }, [supabase]);

  const toggleMenu = useCallback(() => setOpen((v) => !v), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMore = useCallback(() => setMoreOpen((v) => !v), []);
  const toggleNotif = useCallback(() => setNotifOpen((v) => !v), []);
  const toggleCreate = useCallback(() => setCreateOpen((v) => !v), []);
  const toggleUser = useCallback(() => setUserOpen((v) => !v), []);
  const openSearch = useCallback(() => window.dispatchEvent(new Event('open-cmdk')), []);

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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('theme', next);
      } catch {}
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const brandLabel = companyName || 'SolarERP';
  const showLogo = !!companyLogoUrl && !logoError;
  const moreActive = overflowLinks.some((l) => pathname.startsWith(l.href));

  const handleLogoLoad = useCallback(() => setLogoLoaded(true), []);
  const handleLogoError = useCallback(() => {
    setLogoError(true);
    setLogoLoaded(true);
  }, []);

  const renderBrand = useCallback((size: 'default' | 'compact') => {
    const heightClass = size === 'compact' ? 'h-7' : 'h-8';
    const skeletonWidthClass = size === 'compact' ? 'w-24' : 'w-28';
    const maxWidthClass = size === 'compact' ? 'max-w-[120px]' : 'max-w-[140px]';
    const skeleton = (
      <span
        className={`${heightClass} ${skeletonWidthClass} rounded-md bg-[var(--bg-subtle)] animate-pulse`}
        aria-hidden
      />
    );

    if (showLogo) {
      return (
        <span className="relative flex items-center">
          {!logoLoaded && skeleton}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyLogoUrl as string}
            alt={brandLabel}
            className={`${heightClass} w-auto ${maxWidthClass} object-contain ${!logoLoaded ? 'absolute opacity-0' : ''}`}
            onLoad={handleLogoLoad}
            onError={handleLogoError}
            loading="eager"
            decoding="async"
          />
        </span>
      );
    }

    if (logoLoading) return skeleton;

    return <span>{brandLabel}</span>;
  }, [showLogo, logoLoaded, companyLogoUrl, brandLabel, logoLoading, handleLogoLoad, handleLogoError]);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--bg-surface)]/80">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
            aria-label="Toggle Menu"
            onClick={toggleMenu}
          >
            {open ? <X size={20} className="text-[var(--text-primary)]" /> : <Menu size={20} className="text-[var(--text-primary)]" />}
          </button>
          <Link
            href="/overview"
            className="flex items-center gap-2 font-semibold text-[var(--text-primary)] hover:text-[var(--primary-600)] transition-colors"
          >
            {renderBrand('default')}
          </Link>
        </div>
        <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-1 md:flex">
          {primaryLinks.map((l) => {
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
                <NavLabel label={l.label} tag={l.tag} />
              </Link>
            );
          })}
          {overflowLinks.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={toggleMore}
                className={
                  'text-sm rounded-lg px-3 py-1.5 transition-all duration-150 whitespace-nowrap font-medium flex items-center gap-1 ' +
                  (moreActive
                    ? 'bg-[var(--primary-100)] text-[var(--primary-700)] dark:bg-[var(--primary-100)]/20 dark:text-[var(--primary-600)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]')
                }
              >
                More
                <ChevronDown size={14} className={moreOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-44 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]"
                >
                  {overflowLinks.map((l) => {
                    const active = pathname.startsWith(l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        role="menuitem"
                        onClick={() => setMoreOpen(false)}
                        className={
                          'block rounded-lg px-3 py-2 text-sm transition-colors ' +
                          (active
                            ? 'bg-[var(--primary-100)] text-[var(--primary-700)] dark:bg-[var(--primary-100)]/20 dark:text-[var(--primary-600)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]')
                        }
                      >
                        <NavLabel label={l.label} tag={l.tag} compact />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {email && (
            <div className="hidden items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-muted)] shadow-sm lg:flex">
              <span>Branch</span>
              <BranchSelect
                value={branchId}
                onChange={setBranchId}
                includeAll
                allLabel="All branches"
                className="!w-auto min-w-[150px] !px-2 !py-1.5 text-sm"
                persist={false}
              />
            </div>
          )}
          <button
            type="button"
            aria-label="Open search"
            onClick={openSearch}
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
              onClick={toggleNotif}
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
              onClick={toggleCreate}
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
                onClick={toggleUser}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] text-sm font-semibold uppercase text-white shadow-sm hover:shadow-[var(--shadow-md)] transition-all duration-150 ring-2 ring-[var(--bg-surface)] ring-offset-0"
                title={email || 'Account'}
              >
                {String(email).charAt(0)}
              </button>
              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]"
                >
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
                  <div className="border-t border-[var(--border-subtle)] pt-2 mt-1">
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Account
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setUserOpen(false)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Settings & Preferences
                    </Link>
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
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  {renderBrand('compact')}
                </div>
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
                {mobileLinks.map((l) => {
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
                      <NavLabel label={l.label} tag={l.tag} compact />
                    </Link>
                  );
                })}
              </div>
              {email && (
                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Branch
                  </div>
                  <BranchSelect
                    value={branchId}
                    onChange={setBranchId}
                    includeAll
                    allLabel="All branches"
                    className="w-full"
                    persist={false}
                  />
                </div>
              )}
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
