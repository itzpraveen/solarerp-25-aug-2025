"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import { isEmail, isPhone, required } from '@/lib/validation';
import Card from '~/components/ui/Card';
import EmptyState from '~/components/ui/EmptyState';

export default function CustomersPage() {
  const supabase = supabaseBrowser();
  const [customers, setCustomers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(null);
    if (!required(name)) return setErr('Name is required');
    if (email && !isEmail(email)) return setErr('Invalid email');
    if (phone && !isPhone(phone)) return setErr('Invalid phone');
    setAdding(true);
    const { data: prof, error: pErr } = await supabase.from('profiles').select('tenant_id').single();
    if (pErr || !prof?.tenant_id) { setAdding(false); return setErr('Profile not ready'); }
    // duplicate phone check within tenant
    if (phone) {
      const { data: dup } = await supabase.from('customers').select('id').eq('tenant_id', prof.tenant_id).eq('phone', phone).maybeSingle();
      if (dup) { setAdding(false); return setErr('Phone already exists for this tenant'); }
    }
    const { error } = await supabase.from('customers').insert({ tenant_id: prof!.tenant_id, name, phone: phone || null, email: email || null, address: address || null });
    setAdding(false);
    if (error) return setErr(error.message);
    setName(''); setPhone(''); setEmail(''); setAddress('');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Customers</h1>
        <input className="rounded border px-3 py-2 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {err && <div className="rounded border bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={add} loading={adding}>Add</Button>
            <a
              className="rounded border px-3 py-2 text-sm"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('Name,Phone,Email,Address\n' + (customers.map(c => `${c.name || ''},${c.phone || ''},${c.email || ''},${c.address || ''}`).join('\n')))}" download="customers.csv"`}
            >Export CSV</a>
          </div>
        </div>
      </Card>
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Add a customer to start creating jobs and proposals." action={<Button onClick={add} disabled={!name}>Quick add</Button>} />
      ) : (
        <ul className="space-y-2">
          {customers.filter((c) => !search || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(search.toLowerCase())).map((c) => (
            <li key={c.id} className="rounded border bg-white p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name || '—'}</div>
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
