"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PipelineBoard from 'components/PipelineBoard';
import Button from '~/components/ui/Button';
import Card from '~/components/ui/Card';
import { supabaseBrowser } from '@/lib/supabaseClient';

type Customer = { id: string; name: string };

export default function JobsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custId, setCustId] = useState('');
  const [systemType, setSystemType] = useState('On-grid');
  const [capacity, setCapacity] = useState<number>(1);
  const [location, setLocation] = useState('');
  const [roof, setRoof] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('id,name').order('name');
      setCustomers((data as any[]) || []);
    })();
  }, []);

  const createJob = async () => {
    setMsg(null);
    if (!custId) { setMsg('Select a customer'); return; }
    if ((Number(capacity) || 0) <= 0) { setMsg('Capacity must be > 0'); return; }
    setCreating(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('tenant_id').maybeSingle();
      const { data: job } = await supabase
        .from('jobs')
        .insert({ tenant_id: (prof as any)!.tenant_id, customer_id: custId, system_type: systemType, status: 'Lead', capacity_kw: capacity, location: location || null, roof_type: roof || null, date_lead: new Date().toISOString().slice(0,10) })
        .select('id')
        .single();
      router.push(`/jobs/${(job as any).id}`);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>Customers</Button>
          <Button size="sm" onClick={() => router.push('/leads')}>Leads</Button>
        </div>
      </div>
      <Card title="Quick Create Job">
        {msg && <div className="mb-2 rounded border bg-red-50 p-2 text-xs text-red-700">{msg}</div>}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <select className="rounded border px-2 py-2" value={custId} onChange={(e) => setCustId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select className="rounded border px-2 py-2" value={systemType} onChange={(e) => setSystemType(e.target.value)}>
            <option>On-grid</option>
            <option>Hybrid</option>
            <option>Off-grid</option>
            <option>Inverter & Battery</option>
            <option>Solar Water Heater</option>
          </select>
          <input className="rounded border px-3 py-2" type="number" placeholder="Capacity kW" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          <input className="rounded border px-3 py-2" placeholder="Location/Place" value={location} onChange={(e) => setLocation(e.target.value)} />
          <div className="flex gap-2">
            <input className="w-full rounded border px-3 py-2" placeholder="Roof type" value={roof} onChange={(e) => setRoof(e.target.value)} />
            <Button onClick={createJob} loading={creating}>Create</Button>
          </div>
        </div>
      </Card>
      <PipelineBoard />
    </div>
  );
}
