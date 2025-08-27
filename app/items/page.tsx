'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';
import RequireOwner from '~/components/RequireOwner';
import DataTable, { type Column } from '~/components/ui/DataTable';
import { useToast } from '~/components/ui/ToastProvider';

export default function ItemsPage() {
  const supabase = supabaseBrowser();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    item_code: '',
    name: '',
    category: '',
    unit: '',
    gst_rate: 0,
    mrp: 0,
    preferred_vendor: '',
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setErr(null);
    let q = supabase.from('items').select('*').order('name');
    if (!showArchived) q = q.eq('archived', false as any);
    const { data, error } = await q;
    if (error) setErr(error.message);
    setItems(data || []);
  };
  useEffect(() => {
    load();
  }, [showArchived]);

  function validateItemPayload(p: any) {
    if (!p.item_code || !p.name) return 'Code and name are required';
    const gst = Number(p.gst_rate ?? 0);
    if (Number.isNaN(gst) || gst < 0 || gst > 100)
      return 'GST % must be between 0 and 100';
    const mrp = Number(p.mrp ?? 0);
    if (Number.isNaN(mrp) || mrp < 0) return 'MRP must be 0 or greater';
    return null;
  }

  const add = async () => {
    const v = validateItemPayload(form);
    if (v) {
      setErr(v);
      return;
    }
    setAdding(true);
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    if (pErr || !prof?.tenant_id) {
      setAdding(false);
      toast({ title: 'Profile not ready', variant: 'error' });
      return;
    }
    const { error } = await supabase.from('items').insert({
      item_code: form.item_code,
      tenant_id: prof!.tenant_id,
      name: form.name,
      category: form.category || null,
      unit: form.unit || null,
      gst_rate: Number(form.gst_rate) || 0,
      mrp: Number(form.mrp) || 0,
      preferred_vendor: form.preferred_vendor || null,
    });
    setAdding(false);
    if (error) {
      toast({
        title: 'Add failed',
        description: error.message,
        variant: 'error',
      });
      return;
    }
    setForm({
      item_code: '',
      name: '',
      category: '',
      unit: '',
      gst_rate: 0,
      mrp: 0,
      preferred_vendor: '',
    });
    toast({ title: 'Item added', variant: 'success' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Items</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <RequireOwner
        fallback={
          <Card>
            <div className="text-sm text-gray-600">
              Only admins can add items.
            </div>
          </Card>
        }
      >
        <Card>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <Input
              placeholder="Item Code"
              value={form.item_code}
              onChange={(e) => setForm({ ...form, item_code: e.target.value })}
            />
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Input
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <Input
              type="number"
              placeholder="GST %"
              value={form.gst_rate}
              onChange={(e) =>
                setForm({ ...form, gst_rate: Number(e.target.value) })
              }
            />
            <Input
              type="number"
              placeholder="MRP"
              value={form.mrp}
              onChange={(e) =>
                setForm({ ...form, mrp: Number(e.target.value) })
              }
            />
            <Input
              className="md:col-span-5"
              placeholder="Preferred Vendor"
              value={form.preferred_vendor}
              onChange={(e) =>
                setForm({ ...form, preferred_vendor: e.target.value })
              }
            />
            <Button onClick={add} className="md:col-span-6" loading={adding}>
              Add Item
            </Button>
          </div>
        </Card>
      </RequireOwner>
      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add standard parts and accessories for quick quoting and BOQs."
        />
      ) : (
        <DataTable
          rows={items.filter(
            (it) =>
              !search ||
              `${it.item_code} ${it.name} ${it.category}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )}
          columns={
            [
              { key: 'item_code', header: 'Code' },
              {
                key: 'name',
                header: 'Name',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                  ) : (
                    it.name || '—'
                  ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      value={editForm.category || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                    />
                  ) : (
                    it.category || '—'
                  ),
              },
              {
                key: 'unit',
                header: 'Unit',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      value={editForm.unit || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, unit: e.target.value })
                      }
                    />
                  ) : (
                    it.unit || '—'
                  ),
              },
              {
                key: 'gst_rate',
                header: 'GST %',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      type="number"
                      value={editForm.gst_rate || 0}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          gst_rate: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    (it.gst_rate ?? '—')
                  ),
              },
              {
                key: 'mrp',
                header: 'MRP',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      type="number"
                      value={editForm.mrp || 0}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          mrp: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    (it.mrp ?? '—')
                  ),
              },
              {
                key: 'preferred_vendor',
                header: 'Vendor',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <Input
                      value={editForm.preferred_vendor || ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          preferred_vendor: e.target.value,
                        })
                      }
                    />
                  ) : (
                    it.preferred_vendor || '—'
                  ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (it: any) =>
                  editing === it.item_code ? (
                    <div className="whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={async () => {
                          const v = validateItemPayload({
                            ...editForm,
                            item_code: it.item_code,
                          });
                          if (v) {
                            setErr(v);
                            return;
                          }
                          await supabase
                            .from('items')
                            .update({
                              name: editForm.name,
                              category: editForm.category,
                              unit: editForm.unit,
                              gst_rate: Number(editForm.gst_rate) || 0,
                              mrp: Number(editForm.mrp) || 0,
                              preferred_vendor: editForm.preferred_vendor,
                            })
                            .eq('item_code', it.item_code);
                          setEditing(null);
                          load();
                          toast({ title: 'Item saved', variant: 'success' });
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(it.item_code);
                          setEditForm(it);
                        }}
                      >
                        Edit
                      </Button>
                      <RequireOwner>
                        <Button
                          variant={it.archived ? 'secondary' : 'danger'}
                          size="sm"
                          className="ml-2"
                          onClick={async () => {
                            if (!it.archived) {
                              const ok = confirm(
                                'Archive this item? It will be hidden from pickers and kits.'
                              );
                              if (!ok) return;
                            }
                            await supabase
                              .from('items')
                              .update({ archived: !it.archived })
                              .eq('item_code', it.item_code);
                            load();
                            toast({
                              title: it.archived ? 'Item unarchived' : 'Item archived',
                              variant: 'success',
                            });
                          }}
                        >
                          {it.archived ? 'Unarchive' : 'Archive'}
                        </Button>
                      </RequireOwner>
                    </div>
                  ),
              },
            ] as Column<any>[]
          }
        />
      )}
    </div>
  );
}
