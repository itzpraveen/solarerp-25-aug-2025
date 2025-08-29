'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';

export default function ServiceTickets() {
  const supabase = supabaseBrowser();
  const [tickets, setTickets] = useState<any[]>([]);
  const [summary, setSummary] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setErr(null);
    const { data, error } = await supabase
      .from('service_tickets')
      .select('*, customers(name), jobs(id)')
      .order('"date"', { ascending: false });
    if (error) setErr(error.message);
    setTickets(data || []);
    const { data: cust } = await supabase
      .from('customers')
      .select('id,name')
      .order('name');
    setCustomers(cust || []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!customerId) return alert('Select a customer');
    setAdding(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = (u?.user as any)?.id as string | undefined;
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid as any)
      .maybeSingle();
    if (!prof?.tenant_id) {
      setAdding(false);
      return alert('Profile not ready');
    }
    const { error } = await supabase.from('service_tickets').insert({
      tenant_id: (prof as any)!.tenant_id,
      customer_id: customerId,
      date: new Date().toISOString().slice(0, 10),
      summary,
    });
    setAdding(false);
    if (error) return alert(`Add failed: ${error.message}`);
    setSummary('');
    setCustomerId('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Service Tickets</h1>
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="Issue summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button onClick={add} loading={adding}>
            Add
          </Button>
        </div>
      </Card>
      {tickets.length === 0 ? (
        <EmptyState
          title="No service tickets"
          description="Log post-install issues here for tracking and accountability."
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => {
            const cname = Array.isArray(t.customers)
              ? t.customers?.[0]?.name || '—'
              : (t as any)?.customers?.name || '—';
            return (
              <li
                key={t.id}
                className="rounded border bg-white p-3 text-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.summary || '—'}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {cname}
                    {t.jobs?.id
                      ? ` • Job ${String(t.jobs.id).slice(0, 8)}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{t.status}</span>
                  <a
                    className="text-blue-600 text-sm"
                    href={`/service/${t.id}`}
                  >
                    Open
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
