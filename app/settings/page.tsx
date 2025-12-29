'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequireOwner from '~/components/RequireOwner';
import Button from '~/components/ui/Button';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import { useToast } from '~/components/ui/ToastProvider';
import TaskTemplatesManager from '~/components/TaskTemplatesManager';
import { useRef } from 'react';

export default function SettingsPage() {
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({
    currency: 'INR',
    default_tax_rate: 0,
    upi_id: '',
    proposal_note_ml: '',
  });
  const [tenantId, setTenantId] = useState<string>('');
  const [team, setTeam] = useState<any[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
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
  const [fixingProfiles, setFixingProfiles] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
  // Branch management state
  const [branches, setBranches] = useState<any[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [savingBranch, setSavingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const { data: user } = await supabase.auth.getUser();
        const uid = (user?.user as any)?.id || '';
        setMyUserId(uid);
        const { data: prof } = await supabase
          .from('profiles')
          .select('tenant_id, role')
          .eq('user_id', uid)
          .maybeSingle();
        setMyRole((prof as any)?.role ?? null);
        if (!prof?.tenant_id) {
          // attempt ensureProfile once
          const { data: session } = await supabase.auth.getSession();
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
            setLoading(false);
            return;
          }
          setMyRole((prof2 as any)?.role ?? null);
          setTenantId(prof2.tenant_id);
          const { data } = await supabase
            .from('settings')
            .select('*')
            .eq('tenant_id', prof2.tenant_id)
            .maybeSingle();
          if (data) setForm(data);
          const { data: members } = await supabase
            .from('profiles')
            .select('*')
            .eq('tenant_id', prof2.tenant_id);
          setTeam((members as any[]) || []);
          const { data: br2 } = await supabase
            .from('branches')
            .select('*')
            .eq('tenant_id', prof2.tenant_id)
            .order('name');
          setBranches((br2 as any[]) || []);
          setLoading(false);
          return;
        }
        setTenantId(prof.tenant_id);
        const { data } = await supabase
          .from('settings')
          .select('*')
          .eq('tenant_id', prof.tenant_id)
          .maybeSingle();
        if (data) setForm(data);
        const { data: members } = await supabase
          .from('profiles')
          .select('*')
          .eq('tenant_id', prof.tenant_id);
        setTeam((members as any[]) || []);
        const { data: br } = await supabase
          .from('branches')
          .select('*')
          .eq('tenant_id', prof.tenant_id)
          .order('name');
        setBranches((br as any[]) || []);
      } catch (e: any) {
        setErrorMsg(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    // Basic validation
    const tax = Number(form.default_tax_rate || 0);
    if (Number.isNaN(tax) || tax < 0 || tax > 100) {
      setSaving(false);
      alert('Default Tax % must be between 0 and 100');
      return;
    }
    // Update existing row by id if present, else insert new for this tenant
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from('settings')
        .update({ ...form })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('settings')
        .insert({ ...form, tenant_id: tenantId }));
    }
    setSaving(false);
    if (error) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'error',
      });
      return;
    }
    toast({ title: 'Saved', variant: 'success' });
  };

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
        body: JSON.stringify({ mode: 'all-missing' }),
      });
      const out = await res.json();
      if (!res.ok || !out?.ok) throw new Error(out?.error || 'Fix failed');
      setFixResult(`Updated ${out.updated} user profiles`);
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId);
      setTeam((members as any[]) || []);
      toast({ title: 'Profiles fixed', description: fixResult || '', variant: 'success' });
    } catch (e: any) {
      setFixResult(e?.message || 'Fix failed');
      toast({ title: 'Fix failed', description: e?.message || '', variant: 'error' });
    } finally {
      setFixingProfiles(false);
    }
  };

  const invite = async () => {
    if (!inviteUsername) {
      setFlash('Username required');
      setTimeout(() => setFlash(null), 1500);
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
      setInviteRole('staff');
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId);
      setTeam((members as any[]) || []);
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
      setPasswordDrafts((prev) => ({ ...prev, [userId]: '' }));
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

  const reloadBranches = async () => {
    if (!tenantId) return;
    const { data: br } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    setBranches((br as any[]) || []);
  };

  const addBranch = async () => {
    if (!newBranch.trim()) return;
    setSavingBranch(true);
    await supabase
      .from('branches')
      .insert({ tenant_id: tenantId, name: newBranch.trim() });
    setNewBranch('');
    setSavingBranch(false);
    reloadBranches();
  };

  const saveBranchName = async () => {
    if (!editingBranchId) return;
    const name = editingBranchName.trim();
    if (!name) return;
    setSavingBranch(true);
    await supabase.from('branches').update({ name }).eq('id', editingBranchId);
    setSavingBranch(false);
    setEditingBranchId(null);
    setEditingBranchName('');
    reloadBranches();
  };

  const deleteBranch = async (id: string) => {
    const ok = await confirm({
      title: 'Delete branch',
      description: 'Existing records will have branch cleared. Continue?',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    await supabase.from('branches').delete().eq('id', id);
    reloadBranches();
  };

  return (
    <RequireOwner
      fallback={
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Only Owner/Admin can view and edit settings.
        </div>
      }
    >
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-700">
          Loading settings…
        </div>
      )}
      {flash && (
        <div className="rounded border bg-emerald-50 p-2 text-xs text-emerald-700">
          {flash}
        </div>
      )}
      {errorMsg && (
        <div className="rounded border bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      {!loading && !errorMsg && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Settings</h1>
            {myRole && (
              <span className="rounded-full border px-2 py-1 text-xs text-gray-700">
                Your role:{' '}
                {String(myRole).charAt(0).toUpperCase() +
                  String(myRole).slice(1)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded border bg-white p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">Currency</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.currency || ''}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Default Tax %
                </label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  type="number"
                  value={form.default_tax_rate || 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_tax_rate: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">
                    Quote Prefix
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.quote_prefix || ''}
                    onChange={(e) =>
                      setForm({ ...form, quote_prefix: e.target.value })
                    }
                    placeholder="e.g., q"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Quote Format
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.quote_format || ''}
                    onChange={(e) =>
                      setForm({ ...form, quote_format: e.target.value })
                    }
                    placeholder="e.g., {YY}_{KW}KW_SOLAR PLANT_{NAME}"
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    Tokens: {'{YY}'}, {'{YYYY}'}, {'{KW}'}, {'{SYSTEM}'},{' '}
                    {'{NAME}'}, {'{PLACE}'}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">UPI ID</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.upi_id || ''}
                  onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Company Name</label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.company_name || ''}
                    onChange={(e) =>
                      setForm({ ...form, company_name: e.target.value })
                    }
                    placeholder="Your company legal/trade name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Company Phone
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.company_phone || ''}
                    onChange={(e) =>
                      setForm({ ...form, company_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Company Email
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.company_email || ''}
                    onChange={(e) =>
                      setForm({ ...form, company_email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Company Address
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.company_address || ''}
                    onChange={(e) =>
                      setForm({ ...form, company_address: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Company Logo URL
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.company_logo_url || ''}
                    onChange={(e) =>
                      setForm({ ...form, company_logo_url: e.target.value })
                    }
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        try {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!tenantId) {
                            setFlash('Profile not ready — cannot upload logo');
                            return;
                          }
                          const ext =
                            (f.name.split('.').pop() || '') ||
                            (f.type === 'image/svg+xml'
                              ? 'svg'
                              : f.type === 'image/png'
                                ? 'png'
                                : f.type === 'image/jpeg'
                                  ? 'jpg'
                                  : 'bin');
                          const key = `${tenantId}/logo.${ext}`;
                          const { error } = await supabase.storage
                            .from('documents')
                            .upload(key, f, {
                              upsert: true,
                              contentType: f.type || undefined,
                            } as any);
                          if (error) throw error;
                          setForm({ ...form, company_logo_url: key });
                          setFlash('Logo uploaded. Click Save to persist.');
                        } catch (err: any) {
                          setFlash(String(err?.message || 'Logo upload failed'));
                        } finally {
                          if (logoInputRef.current) logoInputRef.current.value = '';
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Upload Logo
                    </Button>
                    <span className="text-xs text-gray-600">
                      Stores under documents/{tenantId}/logo.* (private).
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Malayalam Note (Proposals)
                </label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.proposal_note_ml || ''}
                  onChange={(e) =>
                    setForm({ ...form, proposal_note_ml: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Deposit % (auto-invoice on Won)
                </label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  type="number"
                  value={form.deposit_percent || 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      deposit_percent: Number(e.target.value),
                    })
                  }
                />
              </div>
              <Button onClick={save} loading={saving}>
                Save
              </Button>
              {/* Mock mode removed for production simplicity */}
            </div>
            <div className="rounded border bg-white p-4 space-y-3">
              <h2 className="text-lg font-medium">Team & Roles</h2>
              <p className="text-sm text-gray-600">
                Manage roles for your team members.
              </p>
              {myRole && (myRole === 'owner' || myRole === 'admin') && (
                <div className="rounded border bg-gray-50 p-3 text-sm">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <input
                      className="rounded border px-3 py-2"
                      placeholder="Username"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                    />
                    <input
                      className="rounded border px-3 py-2"
                      placeholder="Temp password (optional)"
                      type="password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                    />
                    <select
                      className="rounded border px-2 py-2"
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
                    </select>
                    <Button onClick={invite} loading={inviting}>
                      Create
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    New users are created with a username + password. If you
                    leave the password empty, the default admin password is
                    used.
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button onClick={fixMissingProfiles} loading={fixingProfiles} variant="secondary">
                      Fix missing profiles
                    </Button>
                    {fixResult && (
                      <span className="text-xs text-gray-700">{fixResult}</span>
                    )}
                  </div>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="p-2">Name</th>
                    <th className="p-2">Username</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">User ID</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.user_id} className="border-t">
                      <td className="p-2">
                        {myRole === 'owner' || myRole === 'admin' ? (
                          <input
                            className="w-full rounded border px-2 py-1 text-xs"
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
                          <span className="text-xs text-gray-700">
                            {m.display_name || '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-gray-700">
                        {m.username || '—'}
                      </td>
                      <td className="p-2">
                        {myRole === 'owner' || myRole === 'admin' ? (
                          <input
                            className="w-full rounded border px-2 py-1 text-xs"
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
                          <span className="text-xs text-gray-700">
                            {m.phone || '—'}
                          </span>
                        )}
                      </td>
                      <td
                        className="p-2 text-xs text-gray-500"
                        title={m.user_id}
                      >
                        {String(m.user_id).slice(0, 8)}…
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded border px-2 py-1"
                            value={m.role}
                            onChange={async (e) => {
                              const role = e.target.value as any;
                              // Prevent demoting the last owner client-side
                              const adminishCount = team.filter(
                                (t) => t.role === 'owner' || t.role === 'admin',
                              ).length;
                              if (
                                (m.role === 'owner' || m.role === 'admin') &&
                                !['owner', 'admin'].includes(role) &&
                                adminishCount <= 1
                              ) {
                                setFlash(
                                  'Add another admin before demoting the last admin',
                                );
                                setTimeout(() => setFlash(null), 2500);
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
                          </select>
                          {(myRole === 'owner' || myRole === 'admin') &&
                            m.user_id !== myUserId && (
                              <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() =>
                                  setPendingRemove({
                                    userId: m.user_id,
                                    name: m.display_name || m.user_id,
                                  })
                                }
                              >
                                Remove
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="p-2">
                        {myRole === 'owner' || myRole === 'admin' ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="w-40 rounded border px-2 py-1 text-xs"
                              type="password"
                              placeholder="New password"
                              value={passwordDrafts[m.user_id] || ''}
                              onChange={(e) =>
                                setPasswordDrafts((prev) => ({
                                  ...prev,
                                  [m.user_id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              disabled={
                                savingPasswordFor === m.user_id ||
                                !passwordDrafts[m.user_id]
                              }
                              onClick={() =>
                                updatePassword(m.user_id, {
                                  password: passwordDrafts[m.user_id],
                                })
                              }
                            >
                              Set
                            </button>
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              disabled={resettingPasswordFor === m.user_id}
                              onClick={() =>
                                updatePassword(m.user_id, { useDefault: true })
                              }
                            >
                              Reset
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingRemove && (
                <div className="mt-3 rounded border bg-yellow-50 p-3 text-xs text-gray-800">
                  <div className="flex items-center justify-between">
                    <span>Remove {pendingRemove.name} from this tenant?</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingRemove(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const { data: session } =
                              await supabase.auth.getSession();
                            const token = session.session?.access_token;
                            const res = await fetch('/api/team/remove', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token
                                  ? { Authorization: `Bearer ${token}` }
                                  : {}),
                              },
                              body: JSON.stringify({
                                userId: pendingRemove.userId,
                              }),
                            });
                            const out = await res.json();
                            if (!res.ok || !out.ok)
                              throw new Error(out?.error || 'Remove failed');
                            setTeam((prev) =>
                              prev.filter(
                                (x) => x.user_id !== pendingRemove.userId,
                              ),
                            );
                            setPendingRemove(null);
                            setFlash('Member removed');
                            setTimeout(() => setFlash(null), 1500);
                          } catch (e: any) {
                            setFlash(String(e?.message || e));
                            setTimeout(() => setFlash(null), 2500);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="rounded border bg-white p-4 space-y-3">
            <h2 className="text-lg font-medium">Branches</h2>
            <p className="text-sm text-gray-600">
              Create and manage your branches. Deleting a branch clears branch
              on related records.
            </p>
            <div className="flex items-center gap-2">
              <input
                className="rounded border px-3 py-2"
                placeholder="New branch name"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
              />
              <Button
                onClick={addBranch}
                loading={savingBranch}
                disabled={!newBranch.trim()}
              >
                Add
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="p-2">Name</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">
                      {editingBranchId === b.id ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={editingBranchName}
                          onChange={(e) => setEditingBranchName(e.target.value)}
                        />
                      ) : (
                        <span>{b.name}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingBranchId === b.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={saveBranchName}
                            loading={savingBranch}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBranchId(null);
                              setEditingBranchName('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBranchId(b.id as string);
                              setEditingBranchName(b.name as string);
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteBranch(b.id as string)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr>
                    <td className="p-2 text-sm text-gray-500" colSpan={2}>
                      No branches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Task Templates manager */}
          <TaskTemplatesManager tenantId={tenantId} />
        </div>
      )}
    </RequireOwner>
  );
}
