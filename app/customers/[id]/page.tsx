'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '~/components/Breadcrumbs';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequirePermission from '~/components/RequirePermission';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import { isEmail, isPhone, required } from '@/lib/validation';

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const [customer, setCustomer] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; email: string; address: string }>({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: c } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single();
      setCustomer(c || null);
      setForm({
        name: (c as any)?.name || '',
        phone: (c as any)?.phone || '',
        email: (c as any)?.email || '',
        address: (c as any)?.address || '',
      });
      const { data: j } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', params.id);
      setJobs(j || []);
    })();
  }, [params.id]);

  const createJob = async () => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    const { data: j } = await supabase
      .from('jobs')
      .insert({
        tenant_id: prof!.tenant_id,
        customer_id: params.id,
        system_type: 'On-grid',
        status: 'Lead',
        capacity_kw: 1,
      })
      .select('id')
      .single();
    window.location.href = `/jobs/${j!.id}`;
  };

  const save = async () => {
    setErr(null);
    if (!required(form.name)) return setErr('Name is required');
    if (form.email && !isEmail(form.email)) return setErr('Invalid email');
    if (form.phone && !isPhone(form.phone)) return setErr('Invalid phone');
    setSaving(true);
    const { error } = await supabase
      .from('customers')
      .update({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
      })
      .eq('id', params.id);
    setSaving(false);
    if (error) return setErr(error.message);
    setEditing(false);
    // reload
    const { data: c } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .single();
    setCustomer(c || null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{customer?.name}</h1>
        <button
          onClick={createJob}
          className="rounded bg-blue-600 px-3 py-2 text-white"
        >
          New Job
        </button>
      </div>
      <Breadcrumbs
        items={[
          { href: '/customers', label: 'Customers' },
          { label: customer?.name || 'Customer' },
        ]}
      />
      <div className="rounded border bg-white p-4">
        {!editing ? (
          <div className="space-y-1">
            {err && (
              <div className="rounded border bg-red-50 p-2 text-xs text-red-700">{err}</div>
            )}
            <div className="text-sm">Phone: {customer?.phone || '—'}</div>
            <div className="text-sm">Email: {customer?.email || '—'}</div>
            <div className="text-sm">Address: {customer?.address || '—'}</div>
            <RequirePermission perm="leads.edit">
              <div className="pt-2">
                <Button size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </div>
            </RequirePermission>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {err && (
              <div className="md:col-span-4 rounded border bg-red-50 p-2 text-xs text-red-700">{err}</div>
            )}
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="flex gap-2 md:col-span-4">
              <Button onClick={save} loading={saving}>
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold">Jobs</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between">
              <span>
                {j.system_type} • {j.status}
              </span>
              <a className="text-blue-600" href={`/jobs/${j.id}`}>
                Open
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
