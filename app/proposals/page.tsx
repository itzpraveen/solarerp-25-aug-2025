"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import EmptyState from '~/components/ui/EmptyState';

export default function ProposalsPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from('proposals')
      .select('id, job_id, date, kit_name, total, pdf_url, jobs(id, customers(name))')
      .order('"date"', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

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
        <div className="flex items-center gap-3">
          <a className="text-sm text-blue-600" href="/proposals/new">New Proposal</a>
          <a className="text-sm text-gray-700" href="/jobs">Create from a Job →</a>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No proposals yet" description="Generate a proposal from a Job to get started." />
      ) : (
      <div className="rounded border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Kit</th>
              <th className="p-2">Total</th>
              <th className="p-2">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.date || '—'}</td>
                <td className="p-2">{r.jobs?.customers?.name || '—'}</td>
                <td className="p-2">{r.kit_name || '—'}</td>
                <td className="p-2">₹{r.total ?? '—'}</td>
                <td className="p-2">
                  {r.pdf_url ? (
                    <button onClick={() => openPdf(r.pdf_url)} className="text-blue-600">Open PDF</button>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>)}
    </div>
  );
}
