"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequireOwner from '~/components/RequireOwner';

export default function SettingsPage() {
  const supabase = supabaseBrowser();
  const [form, setForm] = useState<any>({ currency: 'INR', default_tax_rate: 0, upi_id: '', proposal_note_ml: '' });
  const [tenantId, setTenantId] = useState<string>('');
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
      setTenantId(prof!.tenant_id);
      const { data } = await supabase.from('settings').select('*').eq('tenant_id', prof!.tenant_id).maybeSingle();
      if (data) setForm(data);
      const { data: members } = await supabase.from('profiles').select('*').eq('tenant_id', prof!.tenant_id);
      setTeam((members as any[]) || []);
    })();
  }, []);

  const save = async () => {
    const { error } = await supabase.from('settings').upsert({ ...form, tenant_id: tenantId }).eq('tenant_id', tenantId);
    if (!error) alert('Saved');
  };

  return (
    <RequireOwner fallback={<div className="rounded border bg-white p-4 text-sm text-gray-600">Only owners can view and edit settings.</div>}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border bg-white p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Currency</label>
              <input className="mt-1 w-full rounded border px-3 py-2" value={form.currency || ''} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Default Tax %</label>
              <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={form.default_tax_rate || 0} onChange={(e) => setForm({ ...form, default_tax_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium">UPI ID</label>
              <input className="mt-1 w-full rounded border px-3 py-2" value={form.upi_id || ''} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Company Phone</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.company_phone || ''} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium">Company Email</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.company_email || ''} onChange={(e) => setForm({ ...form, company_email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium">Company Address</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.company_address || ''} onChange={(e) => setForm({ ...form, company_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium">Company Logo URL</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.company_logo_url || ''} onChange={(e) => setForm({ ...form, company_logo_url: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Malayalam Note (Proposals)</label>
              <textarea className="mt-1 w-full rounded border px-3 py-2" value={form.proposal_note_ml || ''} onChange={(e) => setForm({ ...form, proposal_note_ml: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Deposit % (auto-invoice on Won)</label>
              <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={form.deposit_percent || 0} onChange={(e) => setForm({ ...form, deposit_percent: Number(e.target.value) })} />
            </div>
            <button onClick={save} className="rounded bg-blue-600 px-3 py-2 text-white">Save</button>
          </div>
          <div className="rounded border bg-white p-4 space-y-3">
            <h2 className="text-lg font-medium">Team & Roles</h2>
            <p className="text-sm text-gray-600">Manage roles for your team members.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="p-2">User</th>
                  <th className="p-2">Display Name</th>
                  <th className="p-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.user_id} className="border-t">
                    <td className="p-2 text-xs text-gray-700">{m.user_id}</td>
                    <td className="p-2">{m.display_name || '—'}</td>
                    <td className="p-2">
                      <select
                        className="rounded border px-2 py-1"
                        value={m.role}
                        onChange={async (e) => {
                          const role = e.target.value as 'owner' | 'staff';
                          await supabase.from('profiles').update({ role }).eq('user_id', m.user_id);
                          setTeam((prev) => prev.map((x) => (x.user_id === m.user_id ? { ...x, role } : x)));
                        }}
                      >
                        <option value="owner">Owner</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RequireOwner>
  );
}
