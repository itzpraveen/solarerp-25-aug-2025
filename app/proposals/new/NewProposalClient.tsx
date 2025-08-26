'use client';
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
  const [pdfKey, setPdfKey] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [kitBoq, setKitBoq] = useState<
    { item: string; qty: string; unit?: string; make?: string; mrp?: number }[]
  >([]);
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
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadId, setLeadId] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      setTenantId(profile!.tenant_id);
      const { data: setg } = await supabase
        .from('settings')
        .select('*')
        .eq('tenant_id', profile!.tenant_id)
        .single();
      setSettings(setg);
      setTaxRate(Number(setg?.default_tax_rate || 0));
      setMlNote(setg?.proposal_note_ml || '');
      setCompanyPhone(setg?.company_phone || '');
      setCompanyEmail(setg?.company_email || '');
      setCompanyAddress(setg?.company_address || 'Kerala');
      setCompanyLogo(setg?.company_logo_url || '');
      const { data: k } = await supabase
        .from('kits')
        .select('*')
        .eq('tenant_id', profile!.tenant_id);
      setKits(k || []);
      if (jobId) {
        const { data: j } = await supabase
          .from('jobs')
          .select('*, customers(name, phone, address), tenants(name)')
          .eq('id', jobId)
          .single();
        setJob(j);
        setCustomer((j as any)?.customers?.[0] || null);
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
        // Load leads for selection
        const { data: lds } = await supabase
          .from('leads')
          .select('*')
          .order('date', { ascending: false });
        setLeads(lds || []);
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
    const q = `Q${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_${job?.capacity_kw || ''}kW_${customer?.name || 'Customer'}`;
    setQuoteNo(q);
    const dt = new Date();
    dt.setDate(dt.getDate() + 10);
    setValidTill(dt.toISOString().slice(0, 10));
    setPlantBrand('');
  }, [job, customer]);

  const generate = async () => {
    setErrorMsg(null);
    // Basic validation to avoid generating empty PDFs/rows
    if (!kitName) {
      setErrorMsg('Please select a kit');
      return;
    }
    if ((Number(price) || 0) < 0) {
      setErrorMsg('Price must be 0 or greater');
      return;
    }
    if ((Number(taxRate) || 0) < 0 || (Number(taxRate) || 0) > 100) {
      setErrorMsg('Tax % must be between 0 and 100');
      return;
    }
    if (!quoteNo.trim()) {
      setErrorMsg('Quote number is required');
      return;
    }

    const payload: LongInvoiceData = {
      lang,
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
        place: job?.location || '',
      },
      meta: {
        quoteNo: quoteNo || `Q-${Date.now()}`,
        dateISO: new Date().toISOString(),
        validTillISO: validTill || undefined,
        program: 'PM Surya',
        systemCategory: job?.system_type || 'On-grid',
        plantBrand: plantBrand || '—',
        capacityKW: Number(job?.capacity_kw || 0),
        site: job?.location || '',
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
      paymentTerms: [
        '70% Advance',
        '20% on installation',
        '10% on commissioning',
      ],
      bank: undefined,
      signatures: undefined,
      malayalamNote: lang === 'ml' ? mlNote || undefined : undefined,
    };

    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/pdf/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tenantId, payload }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok)
        throw new Error(out?.error || 'PDF generation failed');
      setSignedUrl(out.url);
      setPdfKey(out.key);
      if (jobId) {
        const addOnSum = addOns.reduce((s, a) => s + (a.amount || 0), 0);
        const beforeTax = (Number(price) || 0) + addOnSum;
        const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
        const total = beforeTax + taxAmt;
        const { data: created } = await supabase
          .from('proposals')
          .insert({
            tenant_id: tenantId,
            job_id: jobId,
            date: new Date().toISOString().slice(0, 10),
            kit_name: kitName,
            price_before_tax: beforeTax,
            tax: taxAmt,
            total,
            pdf_url: out.key,
            lang,
          })
          .select('id, total, pdf_url')
          .single();
        // Audit: proposal created
        try {
          const { data: user } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert({
            tenant_id: tenantId,
            user_id: (user?.user as any)?.id || null,
            action: 'proposals.create',
            entity: 'jobs',
            entity_id: jobId,
            metadata: {
              proposalId: (created as any)?.id,
              total: (created as any)?.total,
              pdfKey: (created as any)?.pdf_url,
            },
          });
        } catch {}
      }
    } catch (e: any) {
      setErrorMsg(String(e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const selectedKit = useMemo(
    () => kits.find((k) => k.kit_name === kitName),
    [kits, kitName],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Proposal</h1>
      <div className="rounded border bg-white p-4 space-y-3">
        {errorMsg && (
          <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
        {!jobId && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">
            No Job selected. You can still generate a PDF. Optionally pick a
            Lead, and after generating you can create a Job and attach this
            proposal.
            <div className="mt-2">
              <label className="block text-xs font-medium">Lead</label>
              <select
                className="mt-1 w-full rounded border px-2 py-2"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">Select a lead (optional)</option>
                {(leads || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.date || ''} • {l.name || ''} • {l.phone || ''} •{' '}
                    {l.interested_capacity_kw || ''}kW
                  </option>
                ))}
              </select>
            </div>
            {signedUrl && pdfKey && leadId && (
              <div className="mt-3">
                <button
                  className="rounded bg-blue-600 px-3 py-2 text-white"
                  onClick={async () => {
                    try {
                      const l = (leads || []).find((x) => x.id === leadId);
                      if (!l) return;
                      const { data: prof } = await supabase
                        .from('profiles')
                        .select('tenant_id')
                        .maybeSingle();
                      const tenantId = (prof as any)!.tenant_id as string;
                      // Reuse existing customer by phone if available
                      let customerId: string | null = null;
                      if (l.phone) {
                        const { data: existing } = await supabase
                          .from('customers')
                          .select('id')
                          .eq('tenant_id', tenantId)
                          .eq('phone', l.phone)
                          .maybeSingle();
                        if (existing?.id) customerId = existing.id as string;
                      }
                      if (!customerId) {
                        const { data: cust } = await supabase
                          .from('customers')
                          .insert({
                            tenant_id: tenantId,
                            name: l.name,
                            phone: l.phone || null,
                            address: l.address || null,
                          })
                          .select('id')
                          .single();
                        customerId = (cust as any)!.id as string;
                      }
                      const today = new Date().toISOString().slice(0, 10);
                      const { data: job } = await supabase
                        .from('jobs')
                        .insert({
                          tenant_id: tenantId,
                          customer_id: customerId!,
                          lead_id: l.id,
                          system_type: 'On-grid',
                          status: 'Quoted',
                          capacity_kw: l.interested_capacity_kw || null,
                          location: l.address || null,
                          date_lead: (l as any)?.date || today,
                          date_quote: today,
                        })
                        .select('id')
                        .single();
                      // Persist proposal row and attach
                      const addOnSum = addOns.reduce(
                        (s, a) => s + (a.amount || 0),
                        0,
                      );
                      const beforeTax = (Number(price) || 0) + addOnSum;
                      const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
                      const total = beforeTax + taxAmt;
                      await supabase
                        .from('proposals')
                        .insert({
                          tenant_id: tenantId,
                          job_id: (job as any)!.id,
                          date: today,
                          kit_name: kitName,
                          price_before_tax: beforeTax,
                          tax: taxAmt,
                          total,
                          pdf_url: pdfKey!,
                          lang,
                        })
                        .select('id')
                        .single();
                      await supabase
                        .from('leads')
                        .update({ status: 'Quoted' })
                        .eq('id', l.id);
                      window.location.href = `/jobs/${(job as any)!.id}?tab=proposals`;
                    } catch (e) {
                      alert(String((e as any)?.message || e));
                    }
                  }}
                >
                  Create Job from Lead + Attach
                </button>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Language</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={lang}
            onChange={(e) => setLang(e.target.value as 'en' | 'ml')}
          >
            <option value="en">English</option>
            <option value="ml">Malayalam</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Kit</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
          >
            <option value="">Select a kit…</option>
            {kits.map((k) => (
              <option key={k.kit_name} value={k.kit_name}>
                {k.kit_name} — ₹{k.selling_price}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">
            Price (before add-ons)
          </label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Tax %</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Quote No</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={quoteNo}
              onChange={(e) => setQuoteNo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Valid Till</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="date"
              value={validTill}
              onChange={(e) => setValidTill(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Plant Brand</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={plantBrand}
              onChange={(e) => setPlantBrand(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Malayalam Note</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={mlNote}
              onChange={(e) => setMlNote(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Company Phone</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Company Email</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Company Address</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Logo URL</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={companyLogo}
              onChange={(e) => setCompanyLogo(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Add-ons</label>
          <div className="mt-1 space-y-2">
            {addOns.map((a, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Label"
                  value={a.label}
                  onChange={(e) =>
                    setAddOns(
                      addOns.map((x, i) =>
                        i === idx ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  placeholder="Amount"
                  value={a.amount}
                  onChange={(e) =>
                    setAddOns(
                      addOns.map((x, i) =>
                        i === idx
                          ? { ...x, amount: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
                <button
                  className="rounded border px-3 py-2"
                  onClick={() => setAddOns(addOns.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="rounded border px-3 py-2"
              onClick={() => setAddOns([...addOns, { label: '', amount: 0 }])}
            >
              Add line
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">BOQ</label>
          <div className="mt-1 space-y-2">
            {kitBoq.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Item"
                  value={r.item}
                  onChange={(e) =>
                    setKitBoq(
                      kitBoq.map((x, j) =>
                        j === i ? { ...x, item: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Qty"
                  value={r.qty}
                  onChange={(e) =>
                    setKitBoq(
                      kitBoq.map((x, j) =>
                        j === i ? { ...x, qty: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Unit"
                  value={r.unit || ''}
                  onChange={(e) =>
                    setKitBoq(
                      kitBoq.map((x, j) =>
                        j === i ? { ...x, unit: e.target.value } : x,
                      ),
                    )
                  }
                />
                <div className="flex gap-2">
                  <input
                    className="rounded border px-3 py-2 w-full"
                    placeholder="Make"
                    value={r.make || ''}
                    onChange={(e) =>
                      setKitBoq(
                        kitBoq.map((x, j) =>
                          j === i ? { ...x, make: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    onClick={() => setKitBoq(kitBoq.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                setKitBoq([
                  ...kitBoq,
                  { item: '', qty: '', unit: '', make: '' },
                ])
              }
            >
              Add BOQ row
            </button>
          </div>
        </div>
        <div className="rounded border bg-gray-50 p-3 text-sm">
          <strong>Tip:</strong> Price guidance — sum of kit MRP x qty ≈{' '}
          {new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(
            kitBoq.reduce(
              (s, r) => s + Number(r.mrp || 0) * Number(r.qty || 0),
              0,
            ),
          )}
        </div>
        <button
          onClick={generate}
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          disabled={generating}
        >
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      {selectedKit?.description && (
        <p className="text-sm text-gray-600">{selectedKit.description}</p>
      )}
      {signedUrl && (
        <div className="rounded border bg-white p-4">
          <h3 className="font-semibold">PDF</h3>
          <a className="text-blue-600" target="_blank" href={signedUrl}>
            Open PDF
          </a>
          {!jobId && leadId && (
            <div className="mt-3">
              <button
                className="rounded bg-emerald-600 px-3 py-2 text-white text-sm"
                onClick={async () => {
                  try {
                    // Ensure customer exists, then create job and save proposal row under it
                    const lead = (leads || []).find((l) => l.id === leadId);
                    const { data: prof } = await supabase
                      .from('profiles')
                      .select('tenant_id')
                      .maybeSingle();
                    // create or reuse customer by phone within tenant
                    let custId: string | null = null;
                    if (lead?.phone) {
                      const { data: dup } = await supabase
                        .from('customers')
                        .select('id')
                        .eq('tenant_id', prof!.tenant_id)
                        .eq('phone', lead.phone)
                        .maybeSingle();
                      custId = dup?.id || null;
                    }
                    if (!custId) {
                      const { data: cust } = await supabase
                        .from('customers')
                        .insert({
                          tenant_id: prof!.tenant_id,
                          name: lead?.name || 'Customer',
                          phone: lead?.phone || null,
                          address: lead?.address || null,
                        })
                        .select('id')
                        .single();
                      custId = (cust as any).id;
                    }
                    const { data: jobRow } = await supabase
                      .from('jobs')
                      .insert({
                        tenant_id: prof!.tenant_id,
                        customer_id: custId!,
                        lead_id: leadId,
                        system_type: 'On-grid',
                        status: 'Lead',
                        capacity_kw: lead?.interested_capacity_kw || 1,
                        location: lead?.address || null,
                        date_lead: new Date().toISOString().slice(0, 10),
                      })
                      .select('*')
                      .single();
                    const addOnSum = addOns.reduce(
                      (s, a) => s + (a.amount || 0),
                      0,
                    );
                    const beforeTax = (Number(price) || 0) + addOnSum;
                    const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
                    const total = beforeTax + taxAmt;
                    // We used mock PDF API key earlier in out.key path; reuse payload meta for quoteNo
                    const qn = quoteNo || `Q-${Date.now()}`;
                    const keyGuess = `${tenantId}/${qn.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '_')}.pdf`;
                    await supabase
                      .from('proposals')
                      .insert({
                        tenant_id: tenantId,
                        job_id: (jobRow as any).id,
                        date: new Date().toISOString().slice(0, 10),
                        kit_name: kitName,
                        price_before_tax: beforeTax,
                        tax: taxAmt,
                        total,
                        pdf_url: keyGuess,
                      });
                    window.location.href = `/jobs/${(jobRow as any).id}`;
                  } catch (e: any) {
                    setErrorMsg(String(e?.message || e));
                  }
                }}
              >
                Create Job from this Lead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
