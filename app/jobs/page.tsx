'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PipelineBoard from 'components/PipelineBoard';
import Button from '~/components/ui/Button';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Alert from '~/components/ui/Alert';
import FormField from '~/components/ui/FormField';
import Label from '~/components/ui/Label';
import { useToast } from '~/components/ui/ToastProvider';
import Segmented from '~/components/ui/Segmented';
import CustomerQuickCreate from '~/components/CustomerQuickCreate';
import CustomerTypeahead from '~/components/CustomerTypeahead';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { PROGRAM_ALLOWED_SYSTEMS, type ProgramType } from '@/lib/program';
import BranchSelect from '~/components/BranchSelect';

type Customer = { id: string; name: string };

export default function JobsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custId, setCustId] = useState('');
  const [systemType, setSystemType] = useState('On-grid');
  const [program, setProgram] = useState<ProgramType>('PM_Surya');
  const [capacity, setCapacity] = useState<number>(1);
  const [location, setLocation] = useState('');
  const [roof, setRoof] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | 'all'>('all');
  const { toast } = useToast();
  const [showMore, setShowMore] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickInit, setQuickInit] = useState<{
    name?: string;
    phone?: string;
    address?: string;
  }>({});
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id,name')
        .order('name');
      setCustomers((data as any[]) || []);
    })();
  }, []);

  // Persist quick create visibility preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pref:jobs:showQuickCreate');
      if (saved === '1') setShowQuickCreate(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        'pref:jobs:showQuickCreate',
        showQuickCreate ? '1' : '0',
      );
    } catch {}
  }, [showQuickCreate]);

  // Prefill last used
  useEffect(() => {
    try {
      const p = localStorage.getItem('pref:job:program') as ProgramType | null;
      const s = localStorage.getItem('pref:job:system');
      const c = localStorage.getItem('pref:job:capacity');
      if (p === 'PM_Surya' || p === 'Commercial') setProgram(p);
      if (s) setSystemType(s);
      if (c && !Number.isNaN(Number(c))) setCapacity(Number(c));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('pref:job:program', program);
    } catch {}
  }, [program]);
  useEffect(() => {
    try {
      localStorage.setItem('pref:job:system', systemType);
    } catch {}
  }, [systemType]);
  useEffect(() => {
    try {
      localStorage.setItem('pref:job:capacity', String(capacity));
    } catch {}
  }, [capacity]);

  // Listen for global header branch changes
  useEffect(() => {
    const h = (e: any) => {
      const v = e?.detail?.value as string | 'all' | undefined;
      if (v !== undefined) setBranchId(v);
    };
    window.addEventListener('branch-change', h as any);
    return () => window.removeEventListener('branch-change', h as any);
  }, []);

  const canCreate = custId && (Number(capacity) || 0) > 0;

  const allowedSystems = PROGRAM_ALLOWED_SYSTEMS[program];
  useEffect(() => {
    // Ensure system type is valid for selected program
    if (!allowedSystems.includes(systemType)) setSystemType(allowedSystems[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  const createJob = async () => {
    setMsg(null);
    if (!custId) {
      setMsg('Select a customer');
      return;
    }
    if ((Number(capacity) || 0) <= 0) {
      setMsg('Capacity must be > 0');
      return;
    }
    if (!allowedSystems.includes(systemType)) {
      setMsg('System not allowed for selected program');
      return;
    }
    setCreating(true);
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      const tenantId = (prof as any)?.tenant_id as string | undefined;
      if (!tenantId) {
        setMsg('Profile not ready');
        setCreating(false);
        return;
      }

      // Ensure a corresponding lead exists to avoid pipeline/leads mismatch
      let leadId: string | null = null;
      try {
        // Fetch customer details for lead creation
        const { data: cust } = await supabase
          .from('customers')
          .select('name, phone, address')
          .eq('id', custId)
          .maybeSingle();
        // Try reuse: find the most recent lead by phone in the same tenant
        if (cust?.phone) {
          const { data: existing } = await supabase
            .from('leads')
            .select('id, status')
            .eq('tenant_id', tenantId)
            .eq('phone', cust.phone)
            .order('date', { ascending: false })
            .limit(1);
          const reuse = Array.isArray(existing) ? existing[0] : null;
          if (reuse?.id) {
            leadId = reuse.id as string;
            // If not converted, mark as converted since we're creating a job now
            if (reuse.status !== 'Converted') {
              await supabase
                .from('leads')
                .update({ status: 'Converted' })
                .eq('id', leadId);
            }
          }
        }
        if (!leadId) {
          const today = new Date().toISOString().slice(0, 10);
          const { data: lead } = await supabase
            .from('leads')
            .insert({
              tenant_id: tenantId,
              date: today,
              name: selectedCustomer?.name || cust?.name || 'Lead',
              phone: (cust as any)?.phone || null,
              address: location || (cust as any)?.address || null,
              interested_capacity_kw: capacity,
              status: 'Converted',
              branch_id: branchId !== 'all' ? (branchId as string) : null,
              source: 'Job',
            })
            .select('id')
            .single();
          leadId = (lead as any)?.id || null;
        }
      } catch {}

      const { data: job } = await supabase
        .from('jobs')
        .insert({
          tenant_id: tenantId,
          customer_id: custId,
          system_type: systemType,
          program_type: program,
          status: 'Lead',
          capacity_kw: capacity,
          location: location || null,
          roof_type: roof || null,
          date_lead: new Date().toISOString().slice(0, 10),
          branch_id: branchId !== 'all' ? branchId : null,
          lead_id: leadId,
        })
        .select('id')
        .single();
      router.push(`/jobs/${(job as any).id}`);
    } catch (e: any) {
      const m = String(e?.message || e);
      setMsg(m);
      toast({ title: 'Create failed', description: m, variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="flex items-center gap-2">
          <div className="hidden text-xs text-gray-600 md:block">Branch</div>
          <div className="min-w-[220px]">
            <BranchSelect value={branchId} onChange={setBranchId} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/customers')}
            title="Manage customers"
          >
            Customers
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/leads')}
            title="Manage leads"
          >
            Leads
          </Button>
          <Button size="sm" onClick={() => setShowQuickCreate((v) => !v)}>
            {showQuickCreate ? 'Hide New Job' : 'New Job'}
          </Button>
        </div>
      </div>
      {showQuickCreate && (
        <Card
          title="Quick Create Job"
          actions={
            <span className="hidden md:inline text-xs text-gray-600">
              Only key fields required; add details under More options
            </span>
          }
        >
          <div aria-live="polite" className="mb-2">
            {msg && <Alert variant="error">{msg}</Alert>}
          </div>
          <div className="grid grid-cols-1 gap-3">
            <form
              className="grid grid-cols-1 gap-2 md:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (canCreate) createJob();
              }}
            >
              <FormField
                id="qc-customer"
                label="Customer"
                hint="Pick or add a new customer"
              >
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomerTypeahead
                      selected={selectedCustomer}
                      onSelect={async (c) => {
                        setSelectedCustomer({ id: c.id, name: c.name || '—' });
                        setCustId(c.id);
                        // Prefill location from customer address if empty
                        if (!location && c.address) setLocation(c.address);
                        else if (!location) {
                          const { data } = await supabase
                            .from('customers')
                            .select('address')
                            .eq('id', c.id)
                            .maybeSingle();
                          if ((data as any)?.address)
                            setLocation((data as any).address);
                        }
                      }}
                      onCreateRequested={(term) => {
                        setQuickInit({ name: term });
                        setQuickCustomerOpen(true);
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuickInit({});
                      setQuickCustomerOpen(true);
                    }}
                    type="button"
                  >
                    New
                  </Button>
                </div>
              </FormField>

              <FormField id="qc-program" label="Program">
                <Segmented
                  options={[
                    { label: 'PM Surya', value: 'PM_Surya' },
                    { label: 'Commercial', value: 'Commercial' },
                  ]}
                  value={program}
                  onChange={(v) => setProgram(v as ProgramType)}
                />
              </FormField>

              <FormField id="qc-system" label="System type">
                <div className="flex flex-wrap gap-1">
                  {allowedSystems.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSystemType(s)}
                      className={`rounded border px-2 py-1 text-sm ${systemType === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField id="qc-capacity" label="Capacity">
                <div className="relative">
                  <Input
                    id="qc-capacity"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Capacity"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">
                    kW
                  </span>
                </div>
              </FormField>
              <div className="md:col-span-2 flex items-end justify-end">
                <Button type="submit" loading={creating} disabled={!canCreate}>
                  Create Job
                </Button>
              </div>
            </form>

            <div>
              <button
                type="button"
                className="text-xs text-blue-600"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore ? 'Hide options' : 'More options'}
              </button>
              {/* Starter templates */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-600">Templates:</span>
                {[
                  { p: 'PM_Surya' as ProgramType, s: 'On-grid', c: 3 },
                  { p: 'PM_Surya' as ProgramType, s: 'On-grid', c: 5 },
                  { p: 'Commercial' as ProgramType, s: 'On-grid', c: 10 },
                ].map((t) => (
                  <button
                    key={`${t.p}-${t.s}-${t.c}`}
                    type="button"
                    className="rounded border px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => {
                      setProgram(t.p);
                      setSystemType(t.s);
                      setCapacity(t.c);
                    }}
                  >
                    {t.c} kW {t.s} •{' '}
                    {t.p === 'PM_Surya' ? 'PM Surya' : 'Commercial'}
                  </button>
                ))}
              </div>
              {showMore && (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-6">
                <FormField id="qc-location" label="Site Address">
                  <Input
                    id="qc-location"
                    placeholder="Site address"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </FormField>
                  <FormField id="qc-roof" label="Roof type">
                    <Input
                      id="qc-roof"
                      className="w-full"
                      placeholder="Flat, Tiled, Sheet…"
                      value={roof}
                      onChange={(e) => setRoof(e.target.value)}
                    />
                  </FormField>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-600">
              Target branch:{' '}
              <span className="font-medium">
                {branchId === 'all'
                  ? 'Unassigned (set branch above)'
                  : 'Selected branch'}
              </span>
            </div>
          </div>
          <CustomerQuickCreate
            open={quickCustomerOpen}
            onClose={() => setQuickCustomerOpen(false)}
            initialName={quickInit.name || ''}
            initialPhone={quickInit.phone || ''}
            initialAddress={quickInit.address || ''}
            onCreated={(id, name, address) => {
              setCustomers((list) => [{ id, name }, ...list]);
              setCustId(id);
              setSelectedCustomer({ id, name });
              if (!location && address) setLocation(address);
            }}
          />
        </Card>
      )}
      <Card title="Pipeline">
        <PipelineBoard
          branchId={branchId === 'all' ? null : (branchId as string)}
        />
      </Card>
    </div>
  );
}
