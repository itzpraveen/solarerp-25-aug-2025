'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Button from '~/components/ui/Button';
import RequireOwner from '~/components/RequireOwner';

export default function ProposalsListPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      if (!prof?.tenant_id) {
        setErr('Profile not ready. Please sign in again.');
        setLoading(false);
        return;
      }
      let q = supabase
        .from('proposals')
        .select('*, jobs(id, customers(name, phone))')
        .eq('tenant_id', prof.tenant_id)
        .order('"date"', { ascending: false });
      if (!showVoided) q = q.is('voided_at', null);
      const { data, error } = await q;
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, [showVoided]);

  const openPdf = async (key?: string | null) => {
    if (!key) return;
    if (!signed[key]) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(key, 60 * 60 * 24 * 7);
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
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
            />
            Show voided
          </label>
          <a
            href="/proposals/new"
            className="rounded bg-blue-600 px-3 py-2 text-white text-sm"
          >
            New Proposal
          </a>
        </div>
      </div>
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No proposals yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded border bg-white p-3 text-sm flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {r.date || '—'} • {r.kit_name || '—'} • ₹{r.total ?? '—'}{' '}
                    {r.lang ? `• ${String(r.lang).toUpperCase()}` : ''}
                  </div>
                  <div className="text-xs text-gray-600">
                    Job: {r.jobs?.id || '—'} • Customer:{' '}
                    {r.jobs?.customers?.[0]?.name || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.voided_at && (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-red-700 border-red-300">
                      Voided
                    </span>
                  )}
                  {r.pdf_url ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPdf(r.pdf_url)}
                    >
                      Open PDF
                    </Button>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                  <RequireOwner>
                    <Button
                      variant={r.voided_at ? 'secondary' : 'danger'}
                      size="sm"
                      onClick={async () => {
                        if (!r.voided_at) {
                          const ok = confirm(
                            'Void this proposal? It will be hidden from default lists.',
                          );
                          if (!ok) return;
                          await supabase
                            .from('proposals')
                            .update({ voided_at: new Date().toISOString() })
                            .eq('id', r.id);
                        } else {
                          await supabase
                            .from('proposals')
                            .update({ voided_at: null })
                            .eq('id', r.id);
                        }
                        // trigger reload
                        setShowVoided((v) => v);
                      }}
                    >
                      {r.voided_at ? 'Unvoid' : 'Void'}
                    </Button>
                  </RequireOwner>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
