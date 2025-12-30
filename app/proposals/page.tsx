'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Button from '~/components/ui/Button';
import RequireOwner from '~/components/RequireOwner';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import PageHeader from '~/components/ui/PageHeader';
import Badge from '~/components/ui/Badge';

export default function ProposalsListPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || 0) / pageSize)),
    [totalCount, pageSize],
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data: u } = await supabase.auth.getUser();
      const uid = (u?.user as any)?.id as string | undefined;
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', uid as any)
        .maybeSingle();
      if (!prof?.tenant_id) {
        setErr('Profile not ready. Please sign in again.');
        setLoading(false);
        return;
      }
      let q = supabase
        .from('proposals')
        .select(
          'id,date,total,pdf_url,voided_at,job_id,jobs(id, customers(name))',
          { count: 'exact' },
        )
        .eq('tenant_id', prof.tenant_id)
        .order('date', { ascending: false });
      if (!showVoided) q = q.is('voided_at', null);
      const term = (debouncedSearch || '').trim();
      if (term) {
        const esc = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
        q = q.or(`kit_name.ilike.%${esc}%,date.ilike.%${esc}%`);
      }
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await q.range(from, to);
      if (error) setErr(error.message);
      setRows((data as any[]) || []);
      setTotalCount(count || 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVoided, page, pageSize, debouncedSearch]);
  useEffect(() => setPage(1), [debouncedSearch, showVoided]);

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
      <PageHeader
        title="Proposals"
        subtitle="Review generated proposals and PDFs."
        actions={
          <>
            <Input
              className="w-52 md:w-64"
              placeholder="Search by date or kit name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
              />
              Show voided
            </label>
            <Button
              size="sm"
              onClick={() => (window.location.href = '/proposals/new')}
            >
              New Proposal
            </Button>
          </>
        }
      />
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
          <>
            <div className="flex items-center justify-between p-2 text-xs text-gray-600 sticky top-0 bg-white z-10 border-b">
              <div>Page {page} of {totalPages} • {totalCount} proposals</div>
              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <Select
                  className="w-20 !px-2 !py-1 text-xs"
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
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
                    <Badge variant="danger">Voided</Badge>
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
              <div>Page {page} of {totalPages} • {totalCount} proposals</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(1)}>« First</Button>
                <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹ Prev</Button>
                <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next ›</Button>
                <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>Last »</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
