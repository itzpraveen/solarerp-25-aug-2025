'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '~/components/Breadcrumbs';
import { supabaseBrowser } from '@/lib/supabaseClient';
import RequirePermission from '~/components/RequirePermission';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import { isEmail, isPhone, required } from '@/lib/validation';
import Card from '~/components/ui/Card';
import Select from '~/components/ui/Select';
import Badge from '~/components/ui/Badge';
import PageHeader from '~/components/ui/PageHeader';
import { getCurrentProfile } from '@/lib/currentProfile';

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
  const [jobOpen, setJobOpen] = useState(false);
  const [jobForm, setJobForm] = useState<{ system_type: string; capacity_kw: number; location: string }>(
    { system_type: 'On-grid', capacity_kw: 1, location: '' },
  );
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
  }, [params.id, supabase]);

  const createJob = async () => {
    const { profile: prof } = await getCurrentProfile<{ tenant_id: string }>(
      supabase as any,
      'tenant_id',
    );
    if (!prof?.tenant_id) {
      setErr('Profile not ready');
      return;
    }
    const { data: j } = await supabase
      .from('jobs')
      .insert({
        tenant_id: prof!.tenant_id,
        customer_id: params.id,
        system_type: jobForm.system_type || 'On-grid',
        status: 'Lead',
        capacity_kw: jobForm.capacity_kw || 1,
        location: jobForm.location || null,
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
      <PageHeader
        title={customer?.name || 'Customer'}
        subtitle="Customer profile and linked jobs."
        actions={
          <>
            {customer?.deleted_at && <Badge variant="danger">Deleted</Badge>}
            <RequirePermission perm="jobs.edit">
              <Button size="sm" onClick={() => setJobOpen((v) => !v)}>
                {jobOpen ? 'Close' : 'New Job'}
              </Button>
            </RequirePermission>
            <RequirePermission perm="leads.edit">
              {customer?.deleted_at ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await supabase
                      .from('customers')
                      .update({ deleted_at: null })
                      .eq('id', params.id);
                    const { data: c } = await supabase
                      .from('customers')
                      .select('*')
                      .eq('id', params.id)
                      .single();
                    setCustomer(c || null);
                  }}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!confirm('Soft-delete this customer? Jobs remain.'))
                      return;
                    await supabase
                      .from('customers')
                      .update({ deleted_at: new Date().toISOString() })
                      .eq('id', params.id);
                    const { data: c } = await supabase
                      .from('customers')
                      .select('*')
                      .eq('id', params.id)
                      .single();
                    setCustomer(c || null);
                  }}
                >
                  Delete
                </Button>
              )}
            </RequirePermission>
          </>
        }
      />
      <Breadcrumbs
        items={[
          { href: '/customers', label: 'Customers' },
          { label: customer?.name || 'Customer' },
        ]}
      />
      <Card title="Customer details">
        {!editing ? (
          <div className="space-y-1">
            {err && (
              <div className="rounded border bg-red-50 p-2 text-xs text-red-700">
                {err}
              </div>
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
              <div className="md:col-span-4 rounded border bg-red-50 p-2 text-xs text-red-700">
                {err}
              </div>
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
      </Card>
      {jobOpen && (
        <Card title="Quick Job">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <div>
              <div className="text-xs text-gray-600">System type</div>
              <Select
                value={jobForm.system_type}
                onChange={(e) =>
                  setJobForm({ ...jobForm, system_type: e.target.value })
                }
              >
                {['On-grid', 'Hybrid', 'Off-grid'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="text-xs text-gray-600">Capacity (kW)</div>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={jobForm.capacity_kw}
                onChange={(e) =>
                  setJobForm({
                    ...jobForm,
                    capacity_kw: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-gray-600">Location</div>
              <Input
                value={jobForm.location}
                onChange={(e) =>
                  setJobForm({ ...jobForm, location: e.target.value })
                }
                placeholder="Place / Address"
              />
            </div>
            <div className="md:col-span-6 flex flex-wrap items-center gap-2">
              <Button onClick={createJob}>Create Job</Button>
              <Button variant="outline" onClick={() => setJobOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      <Card title="Jobs">
        <ul className="space-y-2 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between">
              <span>
                {j.system_type} • {j.status}
              </span>
              <a className="text-[var(--primary-600)]" href={`/jobs/${j.id}`}>
                Open
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
