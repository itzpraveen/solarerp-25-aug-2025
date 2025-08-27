'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '~/components/Breadcrumbs';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const [customer, setCustomer] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: c } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single();
      setCustomer(c || null);
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
        <div className="text-sm">Phone: {customer?.phone || '—'}</div>
        <div className="text-sm">Email: {customer?.email || '—'}</div>
        <div className="text-sm">Address: {customer?.address || '—'}</div>
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
