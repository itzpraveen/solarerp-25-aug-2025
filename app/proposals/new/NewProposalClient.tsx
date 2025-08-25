"use client";
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import type { LongInvoiceData } from '@/lib/renderLongInvoiceHtml';

export default function NewProposalClient() {
  const params = useSearchParams();
  const jobId = params.get('jobId');
  const supabase = supabaseBrowser();
  const [kits, setKits] = useState<any[]>([]);
  const [kitName, setKitName] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [kitBoq, setKitBoq] = useState<{ item: string; qty: string; unit?: string; make?: string; mrp?: number }[]>([]);
  const [addOns, setAddOns] = useState<{ label: string; amount: number }[]>([]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [quoteNo, setQuoteNo] = useState<string>('');
  const [validTill, setValidTill] = useState<string>('');
  const [companyAddress, setCompanyAddress] = useState<string>('Kerala');
  const [companyPhone, setCompanyPhone] = useState<string>('');
  const [companyEmail, setCompanyEmail] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [plantBrand, setPlantBrand] = useState<string>('');
  const [mlNote, setMlNote] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').single();
      setTenantId(profile!.tenant_id);
      const { data: setg } = await supabase.from('settings').select('*').eq('tenant_id', profile!.tenant_id).single();
      setSettings(setg);
      setTaxRate(Number(setg?.default_tax_rate || 0));
      setMlNote(setg?.proposal_note_ml || '');
      setCompanyPhone(setg?.company_phone || '');
      setCompanyEmail(setg?.company_email || '');
      setCompanyAddress(setg?.company_address || 'Kerala');
      setCompanyLogo(setg?.company_logo_url || '');
      const { data: k } = await supabase.from('kits').select('*').eq('tenant_id', profile!.tenant_id);
      setKits(k || []);
      if (jobId) {
        const { data: j } = await supabase.from('jobs').select('*, customers(name, phone, address), tenants(name)').eq('id', jobId).single();
        setJob(j);
        setCustomer(j?.customers);
        if (k && k.length) {
          setKitName(k[0].kit_name);
          setPrice(Number(k[0].selling_price || 0));
        }
      } else {
        // No job: still allow generating a PDF
        if (k && k.length) {
          setKitName(k[0].kit_name);
          setPrice(Number(k[0].selling_price || 0));
        }
      }
    })();
  }, [jobId, supabase]);

  useEffect(() => {
    (async () => {
      if (!kitName) return setKitBoq([]);
      const { data } = await supabase
        .from('kit_items')
        .select('qty, items(name, unit, preferred_vendor, mrp)')
        .eq('kit_name', kitName);
      const rows = (data || []).map((r: any) => ({
        item: r.items?.name || '',
        qty: String(r.qty || ''),
        unit: r.items?.unit || '',
        make: r.items?.preferred_vendor || '',
        mrp: r.items?.mrp ? Number(r.items.mrp) : undefined,
      }));
      setKitBoq(rows);
    })();
  }, [kitName]);

  useEffect(() => {
    // Default quote number and validity 10 days
    const q = `Q${new Date().toISOString().slice(0,10).replaceAll('-', '')}_${(job?.capacity_kw || '')}kW_${customer?.name || 'Customer'}`;
    setQuoteNo(q);
    const dt = new Date(); dt.setDate(dt.getDate() + 10);
    setValidTill(dt.toISOString().slice(0,10));
    setPlantBrand('');
  }, [job, customer]);

  const generate = async () => {
    const payload: LongInvoiceData = {
      company: {
        name: (job?.tenants?.name as string) || 'My Company',
        address: companyAddress || 'Kerala',
        phone: companyPhone || '',
        upi: settings?.upi_id || undefined,
        email: companyEmail || '',
        logoUrl: companyLogo || undefined,
      },
      customer: {
        name: customer?.name || 'Customer',
        phone: customer?.phone || '',
        address: customer?.address || '',
        place: job?.location || ''
      },
      meta: {
        quoteNo: quoteNo || `Q-${Date.now()}`,
        dateISO: new Date().toISOString(),
        validTillISO: validTill || undefined,
        program: 'PM Surya',
        systemCategory: job?.system_type || 'On-grid',
        plantBrand: plantBrand || '—',
        capacityKW: Number(job?.capacity_kw || 0),
        site: job?.location || ''
      },
      money: {
        currency: 'INR',
        projectCost: price,
        addOns: addOns,
        taxRatePct: taxRate,
      },
      pipeline: {},
      kit: { name: kitName },
      boq: { rows: kitBoq },
      assumptions: ['KSEB/Inspectorate fees under customer scope.'],
      warranty: ['OEM standard warranty applies.'],
      priceSchedule: { lines: [], offerValidityDays: 10 },
      paymentTerms: ['70% Advance', '20% on installation', '10% on commissioning'],
      bank: undefined,
      signatures: undefined,
      malayalamNote: mlNote || undefined,
    };

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch('/api/pdf/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ tenantId, payload, pathKey: `${tenantId}/${payload.meta.quoteNo}.pdf` })
    });
    const out = await res.json();
    if (out.ok) setSignedUrl(out.url);
    // persist proposal only if tied to a job
    if (jobId) {
      const addOnSum = addOns.reduce((s, a) => s + (a.amount || 0), 0);
      const beforeTax = price + addOnSum;
      const taxAmt = (beforeTax * (taxRate || 0)) / 100;
      const total = beforeTax + taxAmt;
      await supabase.from('proposals').insert({ tenant_id: tenantId, job_id: jobId, date: new Date().toISOString().slice(0,10), kit_name: kitName, price_before_tax: beforeTax, tax: taxAmt, total, pdf_url: out.key });
    }
  };

  const selectedKit = useMemo(() => kits.find((k) => k.kit_name === kitName), [kits, kitName]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Proposal</h1>
      <div className="rounded border bg-white p-4 space-y-3">
        {!jobId && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">
            No Job selected. You can still generate a PDF, but it won’t be saved to the Proposals list.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Kit</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={kitName} onChange={(e) => setKitName(e.target.value)}>
            {kits.map((k) => (
              <option key={k.kit_name} value={k.kit_name}>{k.kit_name} — ₹{k.selling_price}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Price (before add-ons)</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium">Tax %</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Quote No</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={quoteNo} onChange={(e) => setQuoteNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Valid Till</label>
            <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Plant Brand</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={plantBrand} onChange={(e) => setPlantBrand(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Malayalam Note</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={mlNote} onChange={(e) => setMlNote(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Company Phone</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Company Email</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Company Address</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Logo URL</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={companyLogo} onChange={(e) => setCompanyLogo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Add-ons</label>
          <div className="mt-1 space-y-2">
            {addOns.map((a, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input className="rounded border px-3 py-2" placeholder="Label" value={a.label} onChange={(e) => setAddOns(addOns.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                <input className="rounded border px-3 py-2" type="number" placeholder="Amount" value={a.amount} onChange={(e) => setAddOns(addOns.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} />
                <button className="rounded border px-3 py-2" onClick={() => setAddOns(addOns.filter((_, i) => i !== idx))}>Remove</button>
              </div>
            ))}
            <button className="rounded border px-3 py-2" onClick={() => setAddOns([...addOns, { label: '', amount: 0 }])}>Add line</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">BOQ</label>
          <div className="mt-1 space-y-2">
            {kitBoq.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <input className="rounded border px-3 py-2" placeholder="Item" value={r.item} onChange={(e) => setKitBoq(kitBoq.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                <input className="rounded border px-3 py-2" placeholder="Qty" value={r.qty} onChange={(e) => setKitBoq(kitBoq.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                <input className="rounded border px-3 py-2" placeholder="Unit" value={r.unit || ''} onChange={(e) => setKitBoq(kitBoq.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                <div className="flex gap-2">
                  <input className="rounded border px-3 py-2 w-full" placeholder="Make" value={r.make || ''} onChange={(e) => setKitBoq(kitBoq.map((x, j) => j === i ? { ...x, make: e.target.value } : x))} />
                  <button className="rounded border px-3 py-2" onClick={() => setKitBoq(kitBoq.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>
            ))}
            <button className="rounded border px-3 py-2" onClick={() => setKitBoq([...kitBoq, { item: '', qty: '', unit: '', make: '' }])}>Add BOQ row</button>
          </div>
        </div>
        <div className="rounded border bg-gray-50 p-3 text-sm">
          <strong>Tip:</strong> Price guidance — sum of kit MRP x qty ≈ {' '}
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
            kitBoq.reduce((s, r) => s + (Number(r.mrp || 0) * Number(r.qty || 0)), 0),
          )}
        </div>
        <button onClick={generate} className="rounded bg-blue-600 px-3 py-2 text-white">Generate PDF</button>
      </div>

      {selectedKit?.description && <p className="text-sm text-gray-600">{selectedKit.description}</p>}
      {signedUrl && (
        <div className="rounded border bg-white p-4">
          <h3 className="font-semibold">PDF</h3>
          <a className="text-blue-600" target="_blank" href={signedUrl}>Open PDF</a>
        </div>
      )}
    </div>
  );
}
