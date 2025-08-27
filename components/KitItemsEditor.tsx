'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Card from '~/components/ui/Card';
import { useConfirm } from '~/components/ui/ConfirmProvider';

type KitItemRow = {
  item_code: string;
  qty: number;
  items?: { name?: string | null; unit?: string | null };
};

export default function KitItemsEditor({ kitName }: { kitName: string }) {
  const supabase = supabaseBrowser();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<
    Array<{ item_code: string; name: string; unit?: string | null }>
  >([]);
  const [rows, setRows] = useState<KitItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addCode, setAddCode] = useState('');
  const [addQty, setAddQty] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      const tenantId = (prof as any)?.tenant_id;
      const [{ data: it }, { data: ks }] = await Promise.all([
        tenantId
          ? supabase
              .from('items')
              .select('item_code, name, unit')
              .eq('tenant_id', tenantId)
              .eq('archived', false as any)
              .order('name')
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('kit_items')
          .select('item_code, qty, items(name, unit)')
          .eq('kit_name', kitName),
      ]);
      setItems(
        ((it as any[]) || []).map((x) => ({
          item_code: x.item_code,
          name: x.name,
          unit: x.unit,
        })),
      );
      setRows(((ks as any[]) || []) as KitItemRow[]);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName]);

  const nameByCode = useMemo(() => {
    const m = new Map<string, { name: string; unit?: string | null }>();
    for (const i of items) m.set(i.item_code, { name: i.name, unit: i.unit });
    return m;
  }, [items]);

  const add = async () => {
    if (!addCode) return setError('Select an item');
    if ((Number(addQty) || 0) <= 0) return setError('Qty must be > 0');
    setError(null);
    setSaving(true);
    try {
      await supabase.from('kit_items').upsert({
        kit_name: kitName,
        item_code: addCode,
        qty: Number(addQty) || 1,
      });
      setAddCode('');
      setAddQty(1);
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (code: string) => {
    const ok = await confirm({
      title: 'Remove item',
      description: 'Remove this item from the kit?',
      variant: 'danger',
      confirmText: 'Remove',
    });
    if (!ok) return;
    await supabase
      .from('kit_items')
      .delete()
      .eq('kit_name', kitName)
      .eq('item_code', code);
    await load();
  };

  return (
    <Card title="Kit Items">
      {error && (
        <div className="mb-2 rounded border bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <select
          className="rounded border px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          value={addCode}
          onChange={(e) => setAddCode(e.target.value)}
        >
          <option value="">Select item</option>
          {items.map((it) => (
            <option key={it.item_code} value={it.item_code}>
              {it.name} {it.unit ? `(${it.unit})` : ''}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="Qty"
          value={addQty}
          onChange={(e) => setAddQty(Number(e.target.value))}
        />
        <Button onClick={add} loading={saving}>
          Add
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto rounded border bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="p-3 text-sm text-gray-600 dark:text-gray-400">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-3 text-sm text-gray-600 dark:text-gray-400">
            No items in this kit.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left dark:border-gray-800 dark:bg-gray-800">
                <th className="p-2">Item</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const info = r.items ||
                  nameByCode.get(r.item_code) || { name: r.item_code };
                return (
                  <tr
                    key={r.item_code}
                    className="border-b dark:border-gray-800"
                  >
                    <td className="p-2">{info?.name || r.item_code}</td>
                    <td className="p-2">{Number(r.qty || 0)}</td>
                    <td className="p-2">{info?.unit || ''}</td>
                    <td className="p-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => remove(r.item_code)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
