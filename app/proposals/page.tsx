"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Button from '~/components/ui/Button';

export default function ProposalsListPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      const { data: prof } = await supabase.from('profiles').select('tenant_id').maybeSingle();
      if (!prof?.tenant_id) { setErr('Profile not ready. Please sign in again.'); setLoading(false); return; }
      const { data, error } = await supabase
        .from('proposals')
        .select('*, jobs(id, customers(name, phone))')
        .eq('tenant_id', prof.tenant_id)
        .order('"date"', { ascending: false });
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const openPdf = async (key?: string | null) => {
    if (!key) return;
    if (!signed[key]) {
      const { data } = await supabase.storage.from('documents').createSignedUrl(key, 60 * 60 * 24 * 7);
      if (data?.signedUrl) setSigned((s) => ({ ...s, [key]: data.signedUrl }));
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } else {
      window.open(signed[key], '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Proposals</h1>
        <a href="/proposals/new" className="rounded bg-blue-600 px-3 py-2 text-white text-sm">New Proposal</a>
      </div>
      {err && <div className="rounded border bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <Card>
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No proposals yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.date || '—'} • {r.kit_name || '—'} • ₹{r.total ?? '—'}</div>
                  <div className="text-xs text-gray-600">Job: {r.jobs?.id || '—'} • Customer: {r.jobs?.customers?.[0]?.name || '—'}</div>
                </div>
                {r.pdf_url ? (
                  <Button variant="outline" size="sm" onClick={() => openPdf(r.pdf_url)}>Open PDF</Button>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

