"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';
import RequireOwner from '~/components/RequireOwner';
import KitItemsEditor from '~/components/KitItemsEditor';

export default function KitsPage() {
  const supabase = supabaseBrowser();
  const [kits, setKits] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ kit_name: '', capacity_kw: 1, selling_price: 0, description: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [openItemsForKit, setOpenItemsForKit] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const { data, error } = await supabase.from('kits').select('*').order('capacity_kw');
    if (error) setErr(error.message);
    setKits(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(null);
    if (!form.kit_name.trim()) return setErr('Kit name is required');
    if (form.capacity_kw <= 0) return setErr('Capacity must be > 0');
    if (form.selling_price < 0) return setErr('Price must be ≥ 0');
    const { data: prof, error: pErr } = await supabase.from('profiles').select('tenant_id').maybeSingle();
    if (pErr || !prof?.tenant_id) return setErr('Profile not ready');
    const { error } = await supabase.from('kits').upsert({
      tenant_id: prof!.tenant_id,
      kit_name: form.kit_name,
      capacity_kw: form.capacity_kw,
      selling_price: form.selling_price,
      description: form.description || null,
    });
    if (error) return setErr(error.message);
    setForm({ kit_name: '', capacity_kw: 1, selling_price: 0, description: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Kits</h1>
        <input className="rounded border px-3 py-2 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {err && <div className="rounded border bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <RequireOwner fallback={<Card><div className="text-sm text-gray-600">Only owners or admins can add or edit kits.</div></Card>}>
        <Card>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input placeholder="Kit name" value={form.kit_name} onChange={(e) => setForm({ ...form, kit_name: e.target.value })} />
            <Input type="number" min={0} step={0.1} placeholder="Capacity kW" value={form.capacity_kw} onChange={(e) => setForm({ ...form, capacity_kw: Number(e.target.value) })} />
            <Input type="number" placeholder="Selling price" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button onClick={add} className="md:col-span-4">Save Kit</Button>
          </div>
        </Card>
      </RequireOwner>
      {kits.length === 0 ? (
        <EmptyState title="No kits yet" description="Create standard kit offerings to speed up quoting." />
      ) : (
        <ul className="space-y-2">
          {kits.filter((k) => !search || `${k.kit_name} ${k.description}`.toLowerCase().includes(search.toLowerCase())).map((k) => (
            <li key={k.kit_name} className="rounded border bg-white p-3 text-sm">
              {editing === k.kit_name ? (
                <div className="w-full grid grid-cols-1 gap-2 md:grid-cols-4">
                  <Input disabled value={editForm.kit_name} />
                  <Input type="number" value={editForm.capacity_kw || 0} onChange={(e) => setEditForm({ ...editForm, capacity_kw: Number(e.target.value) })} />
                  <Input type="number" value={editForm.selling_price || 0} onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })} />
                  <Input value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  <div className="md:col-span-4 flex gap-2">
                    <Button size="sm" onClick={async () => {
                      if ((Number(editForm.capacity_kw) || 0) <= 0) { setErr('Capacity must be > 0'); return; }
                      if ((Number(editForm.selling_price) || 0) < 0) { setErr('Price must be ≥ 0'); return; }
                      await supabase.from('kits').update({ capacity_kw: Number(editForm.capacity_kw) || 0, selling_price: Number(editForm.selling_price) || 0, description: editForm.description }).eq('kit_name', k.kit_name);
                      setEditing(null); load();
                    }}>Save</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span>{k.kit_name} • {k.capacity_kw ?? '—'} kW • ₹{k.selling_price ?? '—'}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setOpenItemsForKit(openItemsForKit === k.kit_name ? null : k.kit_name)}>
                      {openItemsForKit === k.kit_name ? 'Hide Items' : 'Manage Items'}
                    </Button>
                    <RequireOwner>
                      <Button variant="outline" size="sm" onClick={() => { setEditing(k.kit_name); setEditForm(k); }}>Edit</Button>
                    </RequireOwner>
                  </div>
                </div>
              )}
              {openItemsForKit === k.kit_name && (
                <div className="mt-3">
                  <KitItemsEditor kitName={k.kit_name} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
