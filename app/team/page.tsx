'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequireOwner from '~/components/RequireOwner';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import PageHeader from '~/components/ui/PageHeader';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import { useToast } from '~/components/ui/ToastProvider';

export default function TeamPage() {
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string>('');
  const [team, setTeam] = useState<any[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [myUserId, setMyUserId] = useState<string>('');
  const [myRole, setMyRole] = useState<
    | 'owner'
    | 'admin'
    | 'manager'
    | 'sales'
    | 'technician'
    | 'accountant'
    | 'viewer'
    | 'staff'
    | null
  >(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordVisible, setInvitePasswordVisible] = useState(false);
  const [inviteRole, setInviteRole] = useState<
    | 'owner'
    | 'admin'
    | 'manager'
    | 'sales'
    | 'technician'
    | 'accountant'
    | 'viewer'
    | 'staff'
  >('staff');
  const [inviting, setInviting] = useState(false);
  const [savingPasswordFor, setSavingPasswordFor] = useState<string | null>(
    null,
  );
  const [resettingPasswordFor, setResettingPasswordFor] = useState<
    string | null
  >(null);
  const [passwordDrafts, setPasswordDrafts] = useState<
    Record<string, string>
  >({});
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<string, boolean>
  >({});
  const [fixingProfiles, setFixingProfiles] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const panelClass =
    'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] space-y-3';
  const mutedPanelClass =
    'rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-secondary)]';
  const compactFieldClass = 'px-2 py-1 text-xs rounded-md';

  const reloadTeam = useCallback(
    async (tid?: string) => {
      const lookup = tid || tenantId;
      if (!lookup) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', lookup)
        .order('display_name', { ascending: true });
      setTeam((data as any[]) || []);
    },
    [supabase, tenantId],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const { data: session } = await supabase.auth.getSession();
        const uid = session.session?.user?.id || '';
        if (!uid) {
          setErrorMsg('Please sign in to manage your team.');
          return;
        }
        setMyUserId(uid);
        const { data: prof } = await supabase
          .from('profiles')
          .select('tenant_id, role')
          .eq('user_id', uid)
          .maybeSingle();
        if (!prof?.tenant_id) {
          const token = session.session?.access_token;
          if (token) {
            await fetch('/api/auth/ensureProfile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
          }
          const { data: prof2 } = await supabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('user_id', uid)
            .maybeSingle();
          if (!prof2?.tenant_id) {
            setErrorMsg(
              'Your profile is not ready yet. Please refresh or sign out and sign in again.',
            );
            return;
          }
          setMyRole((prof2 as any)?.role ?? null);
          setTenantId(prof2.tenant_id);
          await reloadTeam(prof2.tenant_id);
          return;
        }
        setMyRole((prof as any)?.role ?? null);
        setTenantId(prof.tenant_id);
        await reloadTeam(prof.tenant_id);
      } catch (e: any) {
        setErrorMsg(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, reloadTeam]);

  const fixMissingProfiles = async () => {
    setFixingProfiles(true);
    setFixResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/ops/backfill-profiles', {
        method: 'POST',
        headers: token
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'current' }),
      });
      const out = await res.json();
      if (!res.ok || !out?.ok) throw new Error(out?.error || 'Fix failed');
      const resultText =
        out.updated > 0 ? 'Profile repaired' : 'No profile changes needed';
      setFixResult(resultText);
      await reloadTeam();
      toast({
        title: 'Profile repaired',
        description: resultText,
        variant: 'success',
      });
    } catch (e: any) {
      setFixResult(e?.message || 'Fix failed');
      toast({ title: 'Fix failed', description: e?.message || '', variant: 'error' });
    } finally {
      setFixingProfiles(false);
    }
  };

  const invite = async () => {
    if (!inviteUsername.trim()) {
      toast({
        title: 'Username required',
        description: 'Enter a username for the new member.',
        variant: 'error',
      });
      return;
    }
    setInviting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          username: inviteUsername.trim(),
          role: inviteRole,
          ...(invitePassword ? { password: invitePassword } : {}),
        }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out?.error || 'Create failed');
      setInviteUsername('');
      setInvitePassword('');
      setInvitePasswordVisible(false);
      setInviteRole('staff');
      await reloadTeam();
      toast({ title: 'User created', variant: 'success' });
    } catch (e: any) {
      toast({
        title: 'Create failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    } finally {
      setInviting(false);
    }
  };

  const updatePassword = async (
    userId: string,
    opts: { password?: string; useDefault?: boolean },
  ) => {
    const nextPassword = opts.password || '';
    if (!nextPassword && !opts.useDefault) {
      toast({
        title: 'Password required',
        description: 'Enter a password or reset to default.',
        variant: 'error',
      });
      return;
    }
    const setting = opts.useDefault ? 'default' : 'custom';
    if (opts.useDefault) setResettingPasswordFor(userId);
    else setSavingPasswordFor(userId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/team/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          ...(opts.useDefault ? { useDefault: true } : { password: nextPassword }),
        }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out?.error || 'Update failed');
      if (opts.useDefault) {
        setPasswordDrafts((prev) => ({ ...prev, [userId]: '' }));
        setPasswordVisibility((prev) => ({ ...prev, [userId]: false }));
      }
      toast({
        title: 'Password updated',
        description: setting === 'default' ? 'Reset to default.' : 'Custom password set.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Password update failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    } finally {
      if (opts.useDefault) setResettingPasswordFor(null);
      else setSavingPasswordFor(null);
    }
  };

  const generatePassword = (length = 12) => {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const values = new Uint32Array(length);
      crypto.getRandomValues(values);
      return Array.from(values, (v) => alphabet[v % alphabet.length]).join('');
    }
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  };

  const handleGeneratePassword = (userId: string) => {
    const next = generatePassword();
    setPasswordDrafts((prev) => ({ ...prev, [userId]: next }));
    setPasswordVisibility((prev) => ({ ...prev, [userId]: true }));
  };

  const handleGenerateInvitePassword = () => {
    const next = generatePassword();
    setInvitePassword(next);
    setInvitePasswordVisible(true);
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', 'true');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast({ title: label, variant: 'success' });
    } catch (err: any) {
      toast({
        title: 'Copy failed',
        description: String(err?.message || err),
        variant: 'error',
      });
    }
  };

  const clearPasswordDraft = (userId: string) => {
    setPasswordDrafts((prev) => ({ ...prev, [userId]: '' }));
    setPasswordVisibility((prev) => ({ ...prev, [userId]: false }));
  };

  const handleRemove = async (member: any) => {
    const label =
      member.display_name || member.username || String(member.user_id);
    const ok = await confirm({
      title: 'Remove member',
      description: `Remove ${label} from this tenant?`,
      variant: 'danger',
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: member.user_id }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out?.error || 'Remove failed');
      setTeam((prev) => prev.filter((x) => x.user_id !== member.user_id));
      toast({ title: 'Member removed', variant: 'success' });
    } catch (e: any) {
      toast({
        title: 'Remove failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    }
  };

  const canManageTeam = myRole === 'owner' || myRole === 'admin';
  const normalizedTeamFilter = teamFilter.trim().toLowerCase();
  const filteredTeam = useMemo(() => {
    if (!normalizedTeamFilter) return team;
    return team.filter((m) => {
      const haystack = [m.display_name, m.username, m.phone, m.user_id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedTeamFilter);
    });
  }, [team, normalizedTeamFilter]);
  const adminCount = team.filter(
    (m) => m.role === 'owner' || m.role === 'admin',
  ).length;

  return (
    <RequireOwner
      fallback={
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
          Only Owner/Admin can manage team access.
        </div>
      }
    >
      {loading && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
          Loading team...
        </div>
      )}
      {errorMsg && (
        <div className="rounded border border-[var(--danger-100)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
          {errorMsg}
        </div>
      )}
      {!loading && !errorMsg && (
        <div className="space-y-4">
          <PageHeader
            title="Team & Roles"
            subtitle="Invite members, update roles, and reset credentials."
            actions={
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                {myRole && (
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1">
                    Your role:{' '}
                    {String(myRole).charAt(0).toUpperCase() +
                      String(myRole).slice(1)}
                  </span>
                )}
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1">
                  Members: {team.length}
                </span>
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1">
                  Admins: {adminCount}
                </span>
              </div>
            }
          />
          <div className={panelClass}>
            <div>
              <h2 className="text-lg font-medium">Invite member</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Create a new username and temporary password.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.4fr_1.6fr_1fr_auto]">
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)]">
                  Username
                </label>
                <Input
                  className="mt-1"
                  placeholder="e.g., renewg.domain"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)]">
                  Temp Password
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Optional"
                    type={invitePasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setInvitePasswordVisible((prev) => !prev)
                    }
                  >
                    {invitePasswordVisible ? 'Hide' : 'Show'}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={handleGenerateInvitePassword}
                  >
                    Generate
                  </Button>
                  {invitePassword && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(invitePassword, 'Password copied')
                      }
                    >
                      Copy
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)]">
                  Role
                </label>
                <Select
                  className="mt-1"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="sales">Sales</option>
                  <option value="technician">Technician</option>
                  <option value="accountant">Accountant</option>
                  <option value="viewer">Viewer</option>
                  <option value="staff">Staff (legacy)</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={invite} loading={inviting}>
                  Create
                </Button>
              </div>
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              If you leave the password empty, the default admin password is
              used. Passwords cannot be recovered; set a new one to share.
            </div>
            <div className={mutedPanelClass}>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={fixMissingProfiles}
                  loading={fixingProfiles}
                  variant="secondary"
                >
                  Repair my profile
                </Button>
                {fixResult && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {fixResult}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={panelClass}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-medium">Team members</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Showing {filteredTeam.length} of {team.length} members.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  className="sm:w-64"
                  placeholder="Search name, username, phone, or ID"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                />
                {teamFilter && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setTeamFilter('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="bg-[var(--bg-subtle)]">
                  <tr className="text-left text-[var(--text-secondary)]">
                    <th className="p-2">Name</th>
                    <th className="p-2">Username</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">User ID</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeam.length === 0 ? (
                    <tr>
                      <td
                        className="p-4 text-center text-xs text-[var(--text-tertiary)]"
                        colSpan={6}
                      >
                        No members match that search.
                      </td>
                    </tr>
                  ) : (
                    filteredTeam.map((m) => (
                      <tr
                        key={m.user_id}
                        className="border-t border-[var(--border-subtle)] align-top transition-colors hover:bg-[var(--bg-subtle)]"
                      >
                        <td className="p-2">
                          {canManageTeam ? (
                            <Input
                              className={compactFieldClass}
                              value={m.display_name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTeam((prev) =>
                                  prev.map((x) =>
                                    x.user_id === m.user_id
                                      ? { ...x, display_name: v }
                                      : x,
                                  ),
                                );
                              }}
                              onBlur={async (e) => {
                                const displayName = e.target.value.trim();
                                try {
                                  const { data: session } =
                                    await supabase.auth.getSession();
                                  const token = session.session?.access_token;
                                  const res = await fetch('/api/team/member', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token
                                        ? { Authorization: `Bearer ${token}` }
                                        : {}),
                                    },
                                    body: JSON.stringify({
                                      userId: m.user_id,
                                      displayName,
                                    }),
                                  });
                                  if (!res.ok)
                                    throw new Error('Failed to save name');
                                } catch (err) {
                                  toast({
                                    title: 'Save failed',
                                    description: String(
                                      (err as any)?.message || err,
                                    ),
                                    variant: 'error',
                                  });
                                }
                              }}
                              placeholder="Display name"
                            />
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">
                              {m.display_name || '--'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-xs text-[var(--text-secondary)]">
                          {m.username || '--'}
                        </td>
                        <td className="p-2">
                          {canManageTeam ? (
                            <Input
                              className={compactFieldClass}
                              value={m.phone || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTeam((prev) =>
                                  prev.map((x) =>
                                    x.user_id === m.user_id
                                      ? { ...x, phone: v }
                                      : x,
                                  ),
                                );
                              }}
                              onBlur={async (e) => {
                                try {
                                  const { data: session } =
                                    await supabase.auth.getSession();
                                  const token = session.session?.access_token;
                                  const res = await fetch('/api/team/member', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token
                                        ? { Authorization: `Bearer ${token}` }
                                        : {}),
                                    },
                                    body: JSON.stringify({
                                      userId: m.user_id,
                                      phone: e.target.value.trim(),
                                    }),
                                  });
                                  if (!res.ok)
                                    throw new Error('Failed to save phone');
                                } catch (err) {
                                  toast({
                                    title: 'Save failed',
                                    description: String(
                                      (err as any)?.message || err,
                                    ),
                                    variant: 'error',
                                  });
                                }
                              }}
                              placeholder="Phone"
                            />
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">
                              {m.phone || '--'}
                            </span>
                          )}
                        </td>
                        <td
                          className="p-2 text-xs text-[var(--text-tertiary)]"
                          title={m.user_id}
                        >
                          {String(m.user_id).slice(0, 8)}...
                        </td>
                        <td className="p-2">
                          {canManageTeam ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                className={compactFieldClass}
                                value={m.role}
                                onChange={async (e) => {
                                  const role = e.target.value as any;
                                  const adminishCount = team.filter(
                                    (t) =>
                                      t.role === 'owner' || t.role === 'admin',
                                  ).length;
                                  if (
                                    (m.role === 'owner' ||
                                      m.role === 'admin') &&
                                    !['owner', 'admin'].includes(role) &&
                                    adminishCount <= 1
                                  ) {
                                    toast({
                                      title:
                                        'Add another admin before demoting the last admin',
                                      variant: 'error',
                                    });
                                    return;
                                  }
                                  try {
                                    const { data: session } =
                                      await supabase.auth.getSession();
                                    const token = session.session?.access_token;
                                    const res = await fetch('/api/team/role', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        ...(token
                                          ? { Authorization: `Bearer ${token}` }
                                          : {}),
                                      },
                                      body: JSON.stringify({
                                        userId: m.user_id,
                                        role,
                                      }),
                                    });
                                    const out = await res.json();
                                    if (!res.ok || !out.ok)
                                      throw new Error(
                                        out?.error || 'Update failed',
                                      );
                                    setTeam((prev) =>
                                      prev.map((x) =>
                                        x.user_id === m.user_id
                                          ? { ...x, role }
                                          : x,
                                      ),
                                    );
                                    toast({
                                      title: 'Role updated',
                                      variant: 'success',
                                    });
                                  } catch (err: any) {
                                    toast({
                                      title: 'Update failed',
                                      description: String(err?.message || err),
                                      variant: 'error',
                                    });
                                  }
                                }}
                              >
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="sales">Sales</option>
                                <option value="technician">Technician</option>
                                <option value="accountant">Accountant</option>
                                <option value="viewer">Viewer</option>
                                <option value="staff">Staff (legacy)</option>
                              </Select>
                              {m.user_id !== myUserId && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handleRemove(m)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">
                              {m.role || '--'}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {canManageTeam ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  className="w-40 px-2 py-1 text-xs rounded-md"
                                  type={
                                    passwordVisibility[m.user_id]
                                      ? 'text'
                                      : 'password'
                                  }
                                  autoComplete="new-password"
                                  placeholder="New password"
                                  value={passwordDrafts[m.user_id] || ''}
                                  onChange={(e) =>
                                    setPasswordDrafts((prev) => ({
                                      ...prev,
                                      [m.user_id]: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    setPasswordVisibility((prev) => ({
                                      ...prev,
                                      [m.user_id]: !prev[m.user_id],
                                    }))
                                  }
                                >
                                  {passwordVisibility[m.user_id] ? 'Hide' : 'Show'}
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={
                                    savingPasswordFor === m.user_id ||
                                    resettingPasswordFor === m.user_id
                                  }
                                  onClick={() =>
                                    handleGeneratePassword(m.user_id)
                                  }
                                >
                                  Generate
                                </Button>
                                {passwordDrafts[m.user_id] && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() =>
                                      copyToClipboard(
                                        passwordDrafts[m.user_id],
                                        'Password copied',
                                      )
                                    }
                                  >
                                    Copy
                                  </Button>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={
                                    savingPasswordFor === m.user_id ||
                                    resettingPasswordFor === m.user_id ||
                                    !passwordDrafts[m.user_id]
                                  }
                                  onClick={() =>
                                    updatePassword(m.user_id, {
                                      password: passwordDrafts[m.user_id],
                                    })
                                  }
                                >
                                  Set
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={
                                    resettingPasswordFor === m.user_id ||
                                    savingPasswordFor === m.user_id
                                  }
                                  onClick={() =>
                                    updatePassword(m.user_id, { useDefault: true })
                                  }
                                >
                                  Reset
                                </Button>
                                {passwordDrafts[m.user_id] && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => clearPasswordDraft(m.user_id)}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              --
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RequireOwner>
  );
}
