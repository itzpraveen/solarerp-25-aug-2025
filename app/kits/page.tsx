"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';
import RequireOwner from '~/components/RequireOwner';

export default function KitsPage() {
  const supabase = supabaseBrowser();
  const [kits, setKits] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ kit_name: '', capacity_kw: 1, selling_price: 0, description: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const load = async () => {
    const { data } = await supabase.from('kits').select('*').order('capacity_kw');
    setKits(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.kit_name) return alert('Kit name is required');
    const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
    await supabase.from('kits').upsert({
      tenant_id: prof!.tenant_id,
      kit_name: form.kit_name,
      capacity_kw: form.capacity_kw,
      selling_price: form.selling_price,
      description: form.description || null,
    });
    setForm({ kit_name: '', capacity_kw: 1, selling_price: 0, description: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Kits</h1>
      <RequireOwner fallback={<Card><div className="text-sm text-gray-600">Only owners can add or edit kits.</div></Card>}>
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
          {kits.map((k) => (
            <li key={k.kit_name} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
              {editing === k.kit_name ? (
                <div className="w-full grid grid-cols-1 gap-2 md:grid-cols-4">
                  <Input disabled value={editForm.kit_name} />
                  <Input type="number" value={editForm.capacity_kw || 0} onChange={(e) => setEditForm({ ...editForm, capacity_kw: Number(e.target.value) })} />
                  <Input type="number" value={editForm.selling_price || 0} onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })} />
                  <Input value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  <div className="md:col-span-4 flex gap-2">
                    <Button size="sm" onClick={async () => { await supabase.from('kits').update({ capacity_kw: editForm.capacity_kw, selling_price: editForm.selling_price, description: editForm.description }).eq('kit_name', k.kit_name); setEditing(null); load(); }}>Save</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <span>{k.kit_name} • {k.capacity_kw ?? '—'} kW • ₹{k.selling_price ?? '—'}</span>
                  <RequireOwner>
                    <Button variant="outline" size="sm" onClick={() => { setEditing(k.kit_name); setEditForm(k); }}>Edit</Button>
                  </RequireOwner>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
