"use client";
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

  const load = async () => {
    const { data } = await supabase.from('service_tickets').select('*').order('date', { ascending: false });
    setTickets(data || []);
    const { data: cust } = await supabase.from('customers').select('id,name').order('name');
    setCustomers(cust || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!customerId) return alert('Select a customer');
    const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
    await supabase.from('service_tickets').insert({ tenant_id: prof!.tenant_id, customer_id: customerId, date: new Date().toISOString().slice(0,10), summary });
    setSummary('');
    setCustomerId('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Service Tickets</h1>
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input placeholder="Issue summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      {tickets.length === 0 ? (
        <EmptyState title="No service tickets" description="Log post-install issues here for tracking and accountability." />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
              <span>{t.summary || '—'}</span>
              <span className="text-xs text-gray-600">{t.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
