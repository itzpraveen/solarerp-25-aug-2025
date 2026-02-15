'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequireOwner from '~/components/RequireOwner';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Textarea from '~/components/ui/Textarea';
import { useConfirm } from '~/components/ui/ConfirmProvider';
import { useToast } from '~/components/ui/ToastProvider';
import TaskTemplatesManager from '~/components/TaskTemplatesManager';
import { useRef } from 'react';
import PageHeader from '~/components/ui/PageHeader';

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
  const [flash, setFlash] = useState<string | null>(null);
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
  const panelClass =
    'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] space-y-3';
  const compactFieldClass = 'px-2 py-1 text-xs rounded-md';
  const sectionTitleClass =
    'text-sm font-semibold text-[var(--text-primary)]';
  const sectionHintClass = 'text-xs text-[var(--text-tertiary)]';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const { data: user } = await supabase.auth.getUser();
        const uid = (user?.user as any)?.id || '';
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
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
          Only Owner/Admin can view and edit settings.
        </div>
      }
    >
      {loading && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
          Loading settings…
        </div>
      )}
      {flash && (
        <div className="rounded border border-[var(--success-100)] bg-[var(--success-50)] p-2 text-xs text-[var(--success-700)]">
          {flash}
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
            title="Settings"
            subtitle="Company profile, billing defaults, and branches."
            actions={
              myRole ? (
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                  Your role:{' '}
                  {String(myRole).charAt(0).toUpperCase() +
                    String(myRole).slice(1)}
                </span>
              ) : null
            }
          />
          <div className="grid grid-cols-1 gap-4">
            <div className={panelClass}>
              <div>
                <h2 className="text-lg font-medium">Company & Billing</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Defaults used across quotes, invoices, and proposals.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Currency</label>
                  <Input
                    className="mt-1"
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
                  <Input
                    className="mt-1"
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
                <div>
                  <label className="block text-sm font-medium">
                    Deposit % (auto-invoice on Won)
                  </label>
                  <Input
                    className="mt-1"
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
                <div>
                  <label className="block text-sm font-medium">UPI ID</label>
                  <Input
                    className="mt-1"
                    value={form.upi_id || ''}
                    onChange={(e) =>
                      setForm({ ...form, upi_id: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <h3 className={sectionTitleClass}>Quotes & Proposals</h3>
                  <p className={sectionHintClass}>
                    Numbering format, prefix, and optional notes.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">
                      Quote Prefix
                    </label>
                    <Input
                      className="mt-1"
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
                    <Input
                      className="mt-1"
                      value={form.quote_format || ''}
                      onChange={(e) =>
                        setForm({ ...form, quote_format: e.target.value })
                      }
                      placeholder="e.g., {YY}_{KW}KW_SOLAR PLANT_{NAME}"
                    />
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Tokens: {'{YY}'}, {'{YYYY}'}, {'{KW}'}, {'{SYSTEM}'},{' '}
                      {'{NAME}'}, {'{PLACE}'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Malayalam Note (Proposals)
                  </label>
                  <Textarea
                    className="mt-1"
                    value={form.proposal_note_ml || ''}
                    onChange={(e) =>
                      setForm({ ...form, proposal_note_ml: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <h3 className={sectionTitleClass}>Company Profile</h3>
                  <p className={sectionHintClass}>
                    Details shown on proposals and invoices.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">
                      Company Name
                    </label>
                    <Input
                      className="mt-1"
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
                    <Input
                      className="mt-1"
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
                    <Input
                      className="mt-1"
                      value={form.company_email || ''}
                      onChange={(e) =>
                        setForm({ ...form, company_email: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">
                      Company Address
                    </label>
                    <Input
                      className="mt-1"
                      value={form.company_address || ''}
                      onChange={(e) =>
                        setForm({ ...form, company_address: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">
                      Company Logo URL
                    </label>
                    <Input
                      className="mt-1"
                      value={form.company_logo_url || ''}
                      onChange={(e) =>
                        setForm({ ...form, company_logo_url: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        if (logoInputRef.current)
                          logoInputRef.current.value = '';
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Upload Logo
                  </Button>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    Stores under documents/{tenantId}/logo.* (private).
                  </span>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <h3 className={sectionTitleClass}>Tax &amp; Compliance</h3>
                  <p className={sectionHintClass}>
                    Required for legal invoicing in India. GSTIN appears on invoices and proposals.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium">GSTIN</label>
                    <Input
                      className="mt-1"
                      value={form.gstin || ''}
                      onChange={(e) =>
                        setForm({ ...form, gstin: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. 32AABCU9603R1ZZ"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">PAN Number</label>
                    <Input
                      className="mt-1"
                      value={form.pan_number || ''}
                      onChange={(e) =>
                        setForm({ ...form, pan_number: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. AABCU9603R"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">State Code</label>
                    <Input
                      className="mt-1"
                      value={form.state_code || '32'}
                      onChange={(e) =>
                        setForm({ ...form, state_code: e.target.value })
                      }
                      placeholder="32 (Kerala)"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <h3 className={sectionTitleClass}>Bank Details</h3>
                  <p className={sectionHintClass}>
                    Shown on invoices for payment. Customers use this to make NEFT/RTGS transfers.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Bank Name</label>
                    <Input
                      className="mt-1"
                      value={form.bank_name || ''}
                      onChange={(e) =>
                        setForm({ ...form, bank_name: e.target.value })
                      }
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Account Number</label>
                    <Input
                      className="mt-1"
                      value={form.bank_account_no || ''}
                      onChange={(e) =>
                        setForm({ ...form, bank_account_no: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">IFSC Code</label>
                    <Input
                      className="mt-1"
                      value={form.bank_ifsc || ''}
                      onChange={(e) =>
                        setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. SBIN0001234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Branch</label>
                    <Input
                      className="mt-1"
                      value={form.bank_branch || ''}
                      onChange={(e) =>
                        setForm({ ...form, bank_branch: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <h3 className={sectionTitleClass}>Invoice Numbering</h3>
                  <p className={sectionHintClass}>
                    Sequential invoice numbers are auto-generated when invoices are created.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Invoice Prefix</label>
                    <Input
                      className="mt-1"
                      value={form.invoice_prefix || 'INV'}
                      onChange={(e) =>
                        setForm({ ...form, invoice_prefix: e.target.value })
                      }
                      placeholder="INV"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Next Invoice Number</label>
                    <Input
                      className="mt-1"
                      type="number"
                      value={form.next_invoice_number || 1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          next_invoice_number: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end pt-2">
                <Button onClick={save} loading={saving}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className={panelClass}>
            <h2 className="text-lg font-medium">Branches</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Create and manage your branches. Deleting a branch clears branch
              on related records.
            </p>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input
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
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-subtle)]">
                  <tr className="text-left text-[var(--text-secondary)]">
                    <th className="p-2">Name</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-2">
                        {editingBranchId === b.id ? (
                          <Input
                            className={compactFieldClass}
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
                      <td className="p-2 text-sm text-[var(--text-tertiary)]" colSpan={2}>
                        No branches yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Task Templates manager */}
          <TaskTemplatesManager tenantId={tenantId} />
        </div>
      )}
    </RequireOwner>
  );
}
