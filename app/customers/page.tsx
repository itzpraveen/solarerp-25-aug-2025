"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Card from '~/components/ui/Card';
import EmptyState from '~/components/ui/EmptyState';

export default function CustomersPage() {
  const supabase = supabaseBrowser();
  const [customers, setCustomers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
    await supabase.from('customers').insert({ tenant_id: prof!.tenant_id, name, phone, address });
    setName(''); setPhone(''); setAddress('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customers</h1>
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Add a customer to start creating jobs and proposals." action={<Button onClick={add} disabled={!name}>Quick add</Button>} />
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-gray-600">{c.phone || '—'}</div>
              </div>
              <a href={`/customers/${c.id}`} className="text-blue-600">Open</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
