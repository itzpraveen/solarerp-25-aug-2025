"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PipelineBoard from 'components/PipelineBoard';
import Button from '~/components/ui/Button';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Alert from '~/components/ui/Alert';
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

  const canCreate = custId && (Number(capacity) || 0) > 0;

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
        <div aria-live="polite" className="mb-2">
          {msg && <Alert variant="error">{msg}</Alert>}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <label className="sr-only" htmlFor="qc-customer">Customer</label>
          <Select id="qc-customer" value={custId} onChange={(e) => setCustId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>

          <label className="sr-only" htmlFor="qc-system">System type</label>
          <Select id="qc-system" value={systemType} onChange={(e) => setSystemType(e.target.value)}>
            <option>On-grid</option>
            <option>Hybrid</option>
            <option>Off-grid</option>
            <option>Inverter & Battery</option>
            <option>Solar Water Heater</option>
          </Select>

          <label className="sr-only" htmlFor="qc-capacity">Capacity (kW)</label>
          <Input
            id="qc-capacity"
            type="number"
            min={0}
            step={0.1}
            placeholder="Capacity (kW)"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />

          <label className="sr-only" htmlFor="qc-location">Location/Place</label>
          <Input id="qc-location" placeholder="Location / Place" value={location} onChange={(e) => setLocation(e.target.value)} />

          <div className="flex gap-2">
            <label className="sr-only" htmlFor="qc-roof">Roof type</label>
            <Input id="qc-roof" className="w-full" placeholder="Roof type (optional)" value={roof} onChange={(e) => setRoof(e.target.value)} />
            <Button onClick={createJob} loading={creating} disabled={!canCreate}>
              Create
            </Button>
          </div>
        </div>
      </Card>
      <PipelineBoard />
    </div>
  );
}
