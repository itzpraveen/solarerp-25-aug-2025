'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import type { LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import PdfProposalImport, { type ParsedProposalHint } from 'components/PdfProposalImport';

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
  const [companyName, setCompanyName] = useState<string>('');
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
  const [program, setProgram] = useState<'PM_Surya' | 'Commercial'>('PM_Surya');
  const [quotationType, setQuotationType] = useState<'Provisional' | 'Final'>(
    'Provisional',
  );
  const [bufferPct, setBufferPct] = useState<number>(5);
  const [lastImport, setLastImport] = useState<ParsedProposalHint | null>(null);
  // Additional details to include in generated PDF (mirrors renderer options)
  const [assumptions, setAssumptions] = useState<string[]>([
    'KSEB/Inspectorate fees under customer scope.',
  ]);
  const [warranty, setWarranty] = useState<string[]>([
    'OEM standard warranty applies.',
  ]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([
    '70% Advance',
    '20% on installation',
    '10% on commissioning',
  ]);
  const [priceLines, setPriceLines] = useState<
    { label: string; amount?: number; note?: string }[]
  >([]);
  const [offerValidityDays, setOfferValidityDays] = useState<number>(10);
  const [bankAccountName, setBankAccountName] = useState<string>('');
  const [bankAccountNo, setBankAccountNo] = useState<string>('');
  const [bankIfsc, setBankIfsc] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankBranch, setBankBranch] = useState<string>('');
  const [preparedBy, setPreparedBy] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');

  // Cover letter, notes, work schedule (optional advanced sections)
  const [includeCover, setIncludeCover] = useState<boolean>(false);
  const [coverTo, setCoverTo] = useState<string>('');
  const [coverSubject, setCoverSubject] = useState<string>('');
  const [coverReference, setCoverReference] = useState<string>('');
  const [coverParagraphs, setCoverParagraphs] = useState<string>('');
  const [signName, setSignName] = useState<string>('');
  const [signTitle, setSignTitle] = useState<string>('');
  const [signPhone, setSignPhone] = useState<string>('');
  const [notes, setNotes] = useState<string[]>([]);
  const [workRows, setWorkRows] = useState<
    { scope: string; details: string; timeline: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      try {
        setErrorMsg(null);
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          setErrorMsg('Please sign in to create a proposal.');
          return;
        }
        // Try fetch profile; if missing, ensure it exists (first-user bootstrap)
        let { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .maybeSingle();
        if (!profile?.tenant_id) {
          const token = sess.session.access_token;
          try {
            const res = await fetch('/api/auth/ensureProfile', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            const out = await res.json();
            if (res.ok && out?.ok && out.tenantId) {
              profile = { tenant_id: out.tenantId } as any;
            }
          } catch {}
        }
        if (!profile?.tenant_id) {
          setErrorMsg('Profile not found. Ask an admin to invite you.');
          return;
        }
        setTenantId(profile.tenant_id);

        const { data: setg } = await supabase
          .from('settings')
          .select('*')
          .eq('tenant_id', profile.tenant_id)
          .single();
        setSettings(setg);
        setTaxRate(Number(setg?.default_tax_rate || 0));
        setMlNote(setg?.proposal_note_ml || '');
        setCompanyName((setg as any)?.company_name || '');
        setCompanyPhone(setg?.company_phone || '');
        setCompanyEmail(setg?.company_email || '');
        setCompanyAddress(setg?.company_address || 'Kerala');
        setCompanyLogo(setg?.company_logo_url || '');

        const { data: k, error: kErr } = await supabase
          .from('kits')
          .select('*')
          .eq('tenant_id', profile.tenant_id);
        if (kErr) throw kErr;
        setKits(k || []);

        if (jobId) {
          const { data: j } = await supabase
            .from('jobs')
            .select('*, customers(name, phone, address), tenants(name)')
            .eq('id', jobId)
            .single();
          setJob(j);
          // Customers relation may come back as object or single-item array depending on config
          {
            const rel = (j as any)?.customers;
            const cust = Array.isArray(rel) ? rel[0] : rel;
            setCustomer(cust || null);
          }
          if ((j as any)?.program_type)
            setProgram((j as any).program_type as 'PM_Surya' | 'Commercial');
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
      } catch (e: any) {
        setErrorMsg(String(e?.message || e));
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
    // Default quote number using settings template
    const dt = new Date();
    const yy = String(dt.getFullYear()).slice(-2);
    const yyyy = String(dt.getFullYear());
    const kw = String(job?.capacity_kw || '');
    const system = String(job?.system_type || 'On-grid');
    const name = String(customer?.name || 'Customer')
      .replace(/\s+/g, ' ')
      .trim();
    const place = String(job?.location || '')
      .replace(/\s+/g, ' ')
      .trim();
    const prefix = (settings?.quote_prefix || 'q').toString();
    const fmt = (
      settings?.quote_format || '{YY}_{KW}KW_SOLAR PLANT_{NAME}'
    ).toString();
    const body = fmt
      .replaceAll('{YY}', yy)
      .replaceAll('{YYYY}', yyyy)
      .replaceAll('{KW}', kw)
      .replaceAll('{SYSTEM}', system)
      .replaceAll('{NAME}', name)
      .replaceAll('{PLACE}', place);
    setQuoteNo(`${prefix}${body}`);
    const v = new Date();
    v.setDate(v.getDate() + 10);
    setValidTill(v.toISOString().slice(0, 10));
    setPlantBrand('');
  }, [job, customer, settings]);

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

    const cover = includeCover
      ? {
          to: coverTo || undefined,
          subject:
            coverSubject ||
            (program === 'PM_Surya'
              ? `QUOTATION FOR ${Number(job?.capacity_kw || 0)} KW ON GRID SOLAR POWER PLANT (PMSG SUBSIDY)`
              : undefined),
          reference: coverReference || undefined,
          paragraphs: coverParagraphs
            .split(/\n\n+|\r\n\r\n+/)
            .map((s) => s.trim())
            .filter(Boolean),
          signatory: {
            name: signName || undefined,
            title: signTitle || undefined,
            phone: signPhone || undefined,
          },
        }
      : undefined;

    const computedAddOns = [
      ...addOns,
      ...(quotationType === 'Provisional' && (Number(bufferPct) || 0) > 0
        ? [
            {
              label: `Uncertainty buffer (${Number(bufferPct)}%)`,
              amount: Math.round(((Number(price) || 0) * Number(bufferPct)) / 100),
            },
          ]
        : []),
    ];

    // Resolve logo: if the saved value looks like a storage key (no http/data),
    // create a short‑lived signed URL for rendering, else use as-is.
    let resolvedLogo = (companyLogo || '').trim();
    if (resolvedLogo && !/^https?:\/\//i.test(resolvedLogo) && !/^data:/i.test(resolvedLogo)) {
      try {
        const { data: s } = await supabase.storage
          .from('documents')
          .createSignedUrl(resolvedLogo, 60 * 60 * 24 * 7);
        if ((s as any)?.signedUrl) resolvedLogo = (s as any).signedUrl as string;
      } catch {}
    }

    const payload: LongInvoiceData = {
      lang,
      company: {
        // Prefer explicit company name from settings; fallback to tenant name
        name:
          companyName || (job?.tenants?.name as string) || 'My Company',
        address: companyAddress || 'Kerala',
        phone: companyPhone || '',
        upi: settings?.upi_id || undefined,
        email: companyEmail || '',
        logoUrl: resolvedLogo || undefined,
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
        program: program === 'PM_Surya' ? 'PM Surya' : 'Commercial',
        quotationType,
        systemCategory: job?.system_type || 'On-grid',
        plantBrand: plantBrand || '—',
        capacityKW: Number(job?.capacity_kw || 0),
        site: job?.location || '',
      },
      money: {
        currency: 'INR',
        projectCost: price,
        addOns: computedAddOns,
        taxRatePct: taxRate,
      },
      pipeline: {},
      kit: { name: kitName },
      boq: { rows: kitBoq },
      ...(cover ? { cover } : {}),
      ...(notes.length
        ? { notes: notes.filter((n) => n.trim()).map((n) => n.trim()) }
        : {}),
      ...(workRows.length
        ? {
            workSchedule: {
              rows: workRows.filter((r) =>
                (r.scope || r.details || r.timeline).trim(),
              ),
            },
          }
        : {}),
      assumptions,
      warranty,
      priceSchedule: { lines: priceLines, offerValidityDays },
      paymentTerms,
      bank:
        bankAccountName || bankAccountNo || bankIfsc || bankName || bankBranch
          ? {
              accountName: bankAccountName || undefined,
              accountNo: bankAccountNo || undefined,
              ifsc: bankIfsc || undefined,
              bank: bankName || undefined,
              branch: bankBranch || undefined,
            }
          : undefined,
      signatures:
        preparedBy || contactPerson || contactNumber
          ? {
              preparedBy: preparedBy || undefined,
              contactPerson: contactPerson || undefined,
              contactNumber: contactNumber || undefined,
            }
          : undefined,
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
        // Include tenantId from profile; server also validates under RLS
        body: JSON.stringify({ tenantId, payload }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) {
        const detail = [out?.hint, out?.cause].filter(Boolean).join(' — ');
        const eid = out?.id ? ` (id: ${out.id})` : '';
        throw new Error(
          `${out?.error || 'PDF generation failed'}${detail ? ` — ${detail}` : ''}${eid}`,
        );
      }
      setSignedUrl(out.url);
      setPdfKey(out.key);
      if (jobId) {
        const addOnSum = computedAddOns.reduce((s, a) => s + (a.amount || 0), 0);
        const beforeTax = (Number(price) || 0) + addOnSum;
        const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
        const total = beforeTax + taxAmt;
        // Try full insert; if DB is missing optional columns, fallback to minimal insert
        const fullRow: any = {
          tenant_id: tenantId,
          job_id: jobId,
          date: new Date().toISOString().slice(0, 10),
          kit_name: kitName,
          price_before_tax: beforeTax,
          tax: taxAmt,
          total,
          pdf_url: out.key,
          lang,
          quotation_type: quotationType,
          valid_till: validTill || null,
          cover: includeCover
            ? {
                to: coverTo || null,
                subject: coverSubject || null,
                reference: coverReference || null,
                paragraphs: coverParagraphs
                  .split(/\n\n+|\r\n\r\n+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
                signatory: {
                  name: signName || null,
                  title: signTitle || null,
                  phone: signPhone || null,
                },
              }
            : null,
          notes: (notes || []).filter((n) => n.trim()).map((n) => n.trim()),
          work_schedule:
            workRows.length > 0
              ? {
                  rows: workRows.map((r) => ({
                    scope: r.scope,
                    details: r.details,
                    timeline: r.timeline,
                  })),
                }
              : null,
        };
        let created: any = null;
        {
          const { data, error } = await supabase
            .from('proposals')
            .insert(fullRow)
            .select('id, total, pdf_url')
            .single();
          if (!error) {
            created = data;
          } else {
            const minimal = {
              tenant_id: tenantId,
              job_id: jobId,
              date: new Date().toISOString().slice(0, 10),
              kit_name: kitName,
              price_before_tax: beforeTax,
              tax: taxAmt,
              total,
              pdf_url: out.key,
            } as any;
            const { data: data2, error: err2 } = await supabase
              .from('proposals')
              .insert(minimal)
              .select('id, total, pdf_url')
              .single();
            if (err2) throw err2;
            created = data2;
          }
        }
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
        {process.env.NEXT_PUBLIC_ENABLE_PDF_IMPORT === '1' && (
          <div>
            <PdfProposalImport
              onParsed={(p) => {
                setLastImport(p);
                if (p.capacityKW !== undefined) {
                  setJob((j: any) => ({ ...(j || {}), capacity_kw: p.capacityKW }));
                }
                if (p.systemType) {
                  setJob((j: any) => ({ ...(j || {}), system_type: p.systemType }));
                }
                if (p.priceBeforeTax !== undefined) setPrice(p.priceBeforeTax);
                if (p.program) setProgram(p.program);
                if (p.quoteNo) setQuoteNo(p.quoteNo);
                if (p.place) setJob((j: any) => ({ ...(j || {}), location: p.place }));
              }}
            />
            {lastImport && (
              <div className="mt-1 text-xs text-gray-600">
                Parsed key fields from PDF. Adjust anything before generating.
              </div>
            )}
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
                      const tenantId = (prof as any)?.tenant_id as
                        | string
                        | undefined;
                      if (!tenantId) {
                        alert('Profile not ready');
                        return;
                      }
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
                      const addOnSum = [
                        ...addOns,
                        ...(quotationType === 'Provisional' && (Number(bufferPct) || 0) > 0
                          ? [
                              {
                                label: `Uncertainty buffer (${Number(bufferPct)}%)`,
                                amount: Math.round(((Number(price) || 0) * Number(bufferPct)) / 100),
                              },
                            ]
                          : []),
                      ].reduce((s, a) => s + (a.amount || 0), 0);
                      const beforeTax = (Number(price) || 0) + addOnSum;
                      const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
                      const total = beforeTax + taxAmt;
                      // Insert proposal row; fallback to minimal fields if optional columns are missing on DB
                      const fullRow2: any = {
                        tenant_id: tenantId,
                        job_id: (job as any)!.id,
                        date: today,
                        kit_name: kitName,
                        price_before_tax: beforeTax,
                        tax: taxAmt,
                        total,
                        pdf_url: pdfKey!,
                        lang,
                        quotation_type: quotationType,
                        valid_till: validTill || null,
                        cover: includeCover
                          ? {
                              to: coverTo || null,
                              subject: coverSubject || null,
                              reference: coverReference || null,
                              paragraphs: coverParagraphs
                                .split(/\n\n+|\r\n\r\n+/)
                                .map((s) => s.trim())
                                .filter(Boolean),
                              signatory: {
                                name: signName || null,
                                title: signTitle || null,
                                phone: signPhone || null,
                              },
                            }
                          : null,
                        notes: (notes || [])
                          .filter((n) => n.trim())
                          .map((n) => n.trim()),
                        work_schedule:
                          workRows.length > 0
                            ? {
                                rows: workRows.map((r) => ({
                                  scope: r.scope,
                                  details: r.details,
                                  timeline: r.timeline,
                                })),
                              }
                            : null,
                      };
                      const { data: created2, error: createErr } = await supabase
                        .from('proposals')
                        .insert(fullRow2)
                        .select('id')
                        .single();
                      if (createErr) {
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
                          })
                          .select('id')
                          .single();
                      }
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
          <label className="block text-sm font-medium">Quotation Type</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={quotationType}
            onChange={(e) => {
              const v = e.target.value as 'Provisional' | 'Final';
              setQuotationType(v);
              if (v === 'Provisional' && bufferPct === 0) setBufferPct(5);
              if (v === 'Final') setBufferPct(0);
            }}
          >
            <option value="Provisional">Provisional</option>
            <option value="Final">Final</option>
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

        {/* Quick preset for Harilal */}
        <div className="rounded border bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>Prefill from client sample</div>
            <button
              className="rounded border px-3 py-1 text-xs"
              type="button"
              onClick={() => {
                setIncludeCover(true);
                setCoverTo('Mr Harilal, Thottinakkare, Mampad');
                setCoverSubject(
                  'QUOTATION FOR 5 KW ON GRID SOLAR POWER PLANT (PMSG SUBSIDY)',
                );
                setCoverReference('Mr Jafar');
                setCoverParagraphs(
                  [
                    'We are pleased to submit our quotation tailored to your 5 kW on‑grid solar power plant requirement under the PM Surya subsidy program.',
                    'TENAGA ENERGY SOLUTIONS LLP is empanelled with ANERT/KSEBL and offers end‑to‑end design, supply and installation with compliance to MNRE and CEA standards.',
                  ].join('\n\n'),
                );
                setSignName('Nithin MV');
                setSignTitle('Designated Partner');
                setSignPhone('9544243300');
                setNotes([
                  '5 kW on‑grid plant can produce ~20 units/day on average (max ~25).',
                  'Plant future expandability up to ~6.5 kW.',
                  'KSEBL refunds ~₹4,000 (excl. GST) after 6 months from commissioning (registration component).',
                  'Quoted prices are inclusive of GST.',
                  'Quotation validity: 10 days; subject to market changes thereafter.',
                ]);
                setWorkRows([
                  {
                    scope: 'TENAGA',
                    details: 'Feasibility report (MNRE NRSP)',
                    timeline: 'Week 1 (after advance)',
                  },
                  {
                    scope: 'TENAGA',
                    details: 'Delivery of materials',
                    timeline: 'Week 1',
                  },
                  {
                    scope: 'TENAGA',
                    details: 'Structure fabrication, panel flooring',
                    timeline: 'Week 2',
                  },
                  {
                    scope: 'TENAGA',
                    details:
                      'DC & AC wiring, earthing, inverter installation & calibration',
                    timeline: 'Week 3',
                  },
                  {
                    scope: 'TENAGA',
                    details:
                      'Submit completion report & checklist; plant registration',
                    timeline: 'Week 3',
                  },
                  {
                    scope: 'KSEB',
                    details: 'Net‑meter allocation and grid connection',
                    timeline: '1–2 weeks post inspection',
                  },
                  {
                    scope: 'Subsidy',
                    details: 'Generate subsidy request (post commissioning)',
                    timeline: '60–90 days after request',
                  },
                ]);
                setProgram('PM_Surya');
                setPlantBrand('RENEW/PAHAL or EMMVEE');
                setPrice(305000);
                setAddOns([
                  {
                    label: 'KSEB feasibility, registration and paperwork (5kW)',
                    amount: 7080,
                  },
                  {
                    label:
                      '2m elevated structure (GP‑16 grade) + walkway + ladder',
                    amount: 30000,
                  },
                  { label: 'Special discount', amount: -7080 },
                ]);
                setTaxRate(0);
                if (!quoteNo) setQuoteNo('q19_5KW_SOLAR PLANT_Harilal Mampad');
              }}
            >
              Load Harilal preset
            </button>
          </div>
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
        {quotationType === 'Provisional' && (
          <div>
            <label className="block text-sm font-medium">Uncertainty buffer %</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="number"
              min={0}
              max={20}
              value={bufferPct}
              onChange={(e) => setBufferPct(Number(e.target.value))}
            />
          </div>
        )}
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

        {/* Cover letter toggle + fields */}
        <div className="rounded border bg-white p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCover}
              onChange={(e) => setIncludeCover(e.target.checked)}
            />
            Include Cover Page
          </label>
          {includeCover && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="block text-sm">To</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={coverTo}
                  onChange={(e) => setCoverTo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Subject</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={coverSubject}
                  onChange={(e) => setCoverSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Reference</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={coverReference}
                  onChange={(e) => setCoverReference(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm">
                  Paragraphs (separate by blank line)
                </label>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 h-28"
                  value={coverParagraphs}
                  onChange={(e) => setCoverParagraphs(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Signatory Name</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Signatory Title</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={signTitle}
                  onChange={(e) => setSignTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Signatory Phone</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={signPhone}
                  onChange={(e) => setSignPhone(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes section */}
        <div>
          <label className="block text-sm font-medium">Notes</label>
          <div className="mt-1 space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  value={n}
                  onChange={(e) =>
                    setNotes(
                      notes.map((x, j) => (i === j ? e.target.value : x)),
                    )
                  }
                />
                <button
                  className="rounded border px-3 py-2"
                  type="button"
                  onClick={() => setNotes(notes.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="rounded border px-3 py-2"
              type="button"
              onClick={() => setNotes([...notes, ''])}
            >
              Add note
            </button>
          </div>
        </div>

        {/* Assumptions & Warranty */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Assumptions</label>
            <div className="mt-1 space-y-2">
              {assumptions.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2"
                    value={n}
                    onChange={(e) =>
                      setAssumptions(
                        assumptions.map((x, j) => (i === j ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    type="button"
                    onClick={() =>
                      setAssumptions(assumptions.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="rounded border px-3 py-2"
                type="button"
                onClick={() => setAssumptions([...assumptions, ''])}
              >
                Add line
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Warranty</label>
            <div className="mt-1 space-y-2">
              {warranty.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2"
                    value={n}
                    onChange={(e) =>
                      setWarranty(
                        warranty.map((x, j) => (i === j ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    type="button"
                    onClick={() => setWarranty(warranty.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="rounded border px-3 py-2"
                type="button"
                onClick={() => setWarranty([...warranty, ''])}
              >
                Add line
              </button>
            </div>
          </div>
        </div>

        {/* Price Schedule */}
        <div>
          <label className="block text-sm font-medium">Price Schedule</label>
          <div className="mt-1 space-y-2">
            {priceLines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Label"
                  value={l.label}
                  onChange={(e) =>
                    setPriceLines(
                      priceLines.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  placeholder="Amount (optional)"
                  value={l.amount ?? ''}
                  onChange={(e) =>
                    setPriceLines(
                      priceLines.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              amount: e.target.value === '' ? undefined : Number(e.target.value),
                            }
                          : x,
                      ),
                    )
                  }
                />
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Note"
                    value={l.note || ''}
                    onChange={(e) =>
                      setPriceLines(
                        priceLines.map((x, j) =>
                          j === i ? { ...x, note: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    onClick={() => setPriceLines(priceLines.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                className="rounded border px-3 py-2"
                onClick={() => setPriceLines([...priceLines, { label: '' }])}
              >
                Add line
              </button>
              <label className="text-sm">Offer validity (days)</label>
              <input
                className="w-24 rounded border px-3 py-2"
                type="number"
                value={offerValidityDays}
                onChange={(e) => setOfferValidityDays(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Payment terms & Bank */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Payment Terms</label>
            <div className="mt-1 space-y-2">
              {paymentTerms.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2"
                    value={n}
                    onChange={(e) =>
                      setPaymentTerms(
                        paymentTerms.map((x, j) => (i === j ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    type="button"
                    onClick={() =>
                      setPaymentTerms(paymentTerms.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="rounded border px-3 py-2"
                type="button"
                onClick={() => setPaymentTerms([...paymentTerms, ''])}
              >
                Add line
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Bank / UPI</label>
            <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="rounded border px-3 py-2"
                placeholder="Account Name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                placeholder="Account No"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                placeholder="IFSC"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                placeholder="Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                placeholder="Branch"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
              />
              {settings?.upi_id && (
                <div className="col-span-full text-xs text-gray-600">
                  UPI from Settings: <span className="font-mono">{settings.upi_id}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div>
          <label className="block text-sm font-medium">Prepared By / Contact</label>
          <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              className="rounded border px-3 py-2"
              placeholder="Prepared By"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
            />
            <input
              className="rounded border px-3 py-2"
              placeholder="Contact Person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
            <input
              className="rounded border px-3 py-2"
              placeholder="Contact Number"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Work schedule */}
        <div>
          <label className="block text-sm font-medium">Work Schedule</label>
          <div className="mt-1 space-y-2">
            {workRows.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Scope (TENAGA/KSEB/Subsidy)"
                  value={r.scope}
                  onChange={(e) =>
                    setWorkRows(
                      workRows.map((x, j) =>
                        i === j ? { ...x, scope: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Details"
                  value={r.details}
                  onChange={(e) =>
                    setWorkRows(
                      workRows.map((x, j) =>
                        i === j ? { ...x, details: e.target.value } : x,
                      ),
                    )
                  }
                />
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Timeline (e.g., Week 1)"
                    value={r.timeline}
                    onChange={(e) =>
                      setWorkRows(
                        workRows.map((x, j) =>
                          i === j ? { ...x, timeline: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    className="rounded border px-3 py-2"
                    type="button"
                    onClick={() =>
                      setWorkRows(workRows.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              className="rounded border px-3 py-2"
              type="button"
              onClick={() =>
                setWorkRows([
                  ...workRows,
                  { scope: '', details: '', timeline: '' },
                ])
              }
            >
              Add row
            </button>
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
      {!jobId && (
        <div className="rounded border bg-white p-4">
          <div className="text-sm font-medium mb-2">Program</div>
          <div className="flex items-center gap-2">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={program}
              onChange={(e) =>
                setProgram(e.target.value as 'PM_Surya' | 'Commercial')
              }
            >
              <option value="PM_Surya">PM Surya</option>
              <option value="Commercial">Commercial</option>
            </select>
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm"
              onClick={() => {
                // Lightweight default presets by program
                if (program === 'PM_Surya') {
                  setNotes([
                    'On‑grid plant sized as per site conditions; final design post feasibility.',
                    'KSEB/Inspectorate charges and processing under customer scope unless specified.',
                    'Subsidy as per MNRE/ANERT program timelines and approvals.',
                  ]);
                  setWorkRows([
                    {
                      scope: 'TENAGA',
                      details: 'MNRE portal feasibility + documentation',
                      timeline: 'Week 1 (after advance)',
                    },
                    {
                      scope: 'TENAGA',
                      details: 'Material delivery; MMS & panel flooring',
                      timeline: 'Weeks 1–2',
                    },
                    {
                      scope: 'TENAGA',
                      details:
                        'AC/DC wiring, earthing, inverter install & calibration',
                      timeline: 'Week 3',
                    },
                    {
                      scope: 'KSEB',
                      details:
                        'Testing, net‑meter allocation & grid connection',
                      timeline: '1–2 weeks post inspection',
                    },
                    {
                      scope: 'Subsidy',
                      details: 'Subsidy request and processing',
                      timeline: '60–90 days after commissioning',
                    },
                  ]);
                } else {
                  setNotes([
                    'On‑grid plant sized as per site conditions; final design post feasibility.',
                    'Statutory approvals and application charges under customer scope unless specified.',
                    'Quoted prices inclusive of GST unless stated otherwise.',
                  ]);
                  setWorkRows([
                    {
                      scope: 'TENAGA',
                      details: 'Feasibility and planning',
                      timeline: 'Week 1',
                    },
                    {
                      scope: 'TENAGA',
                      details: 'Material delivery; MMS & panel flooring',
                      timeline: 'Weeks 1–2',
                    },
                    {
                      scope: 'TENAGA',
                      details:
                        'AC/DC wiring, earthing, inverter install & calibration',
                      timeline: 'Week 3',
                    },
                    {
                      scope: 'DISCOM',
                      details:
                        'Metering & interconnection formalities (if applicable)',
                      timeline: 'Dependent on DISCOM',
                    },
                  ]);
                }
              }}
            >
              Load program preset
            </button>
          </div>
        </div>
      )}

      {signedUrl && (
        <div className="rounded border bg-white p-4">
          <h3 className="font-semibold">PDF</h3>
          <a className="text-blue-600" target="_blank" rel="noreferrer" href={signedUrl}>
            Open PDF
          </a>
          {(customer?.phone ||
            (leadId && leads.find((l) => l.id === leadId)?.phone)) && (
            <div className="mt-3">
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={async () => {
                  try {
                    const phone =
                      customer?.phone ||
                      leads.find((l) => l.id === leadId)?.phone;
                    if (!phone) return;
                    const { data: session } = await supabase.auth.getSession();
                    const token = session.session?.access_token;
                    const res = await fetch('/api/whatsapp/send', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        to: phone,
                        templateName: 'proposal_ready',
                        variables: [
                          customer?.name || 'Customer',
                          String(job?.capacity_kw || ''),
                          signedUrl,
                        ],
                      }),
                    });
                    if (!res.ok) throw new Error('WhatsApp send failed');
                    alert('WhatsApp send enqueued');
                  } catch (e) {
                    alert(String((e as any)?.message || e));
                  }
                }}
              >
                Send via WhatsApp
              </button>
            </div>
          )}
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
                    const tId = (prof as any)?.tenant_id as string | undefined;
                    if (!tId) {
                      setErrorMsg('Profile not ready');
                      return;
                    }
                    // create or reuse customer by phone within tenant
                    let custId: string | null = null;
                    if (lead?.phone) {
                      const { data: dup } = await supabase
                        .from('customers')
                        .select('id')
                        .eq('tenant_id', tId)
                        .eq('phone', lead.phone)
                        .maybeSingle();
                      custId = dup?.id || null;
                    }
                    if (!custId) {
                      const { data: cust } = await supabase
                        .from('customers')
                        .insert({
                          tenant_id: tId,
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
                        tenant_id: tId,
                        customer_id: custId!,
                        lead_id: leadId,
                        system_type: 'On-grid',
                        program_type: program,
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
                    const keyGuess = `${tId}/${qn
                      .replace(/\s+/g, '_')
                      .replace(/[^A-Za-z0-9_\-]/g, '_')}.pdf`;
                    await supabase.from('proposals').insert({
                      tenant_id: tId,
                      job_id: (jobRow as any).id,
                      date: new Date().toISOString().slice(0, 10),
                      kit_name: kitName,
                      price_before_tax: beforeTax,
                      tax: taxAmt,
                      total,
                      pdf_url: keyGuess,
                      lang,
                      valid_till: validTill || null,
                      cover: includeCover
                        ? {
                            to: coverTo || null,
                            subject: coverSubject || null,
                            reference: coverReference || null,
                            paragraphs: coverParagraphs
                              .split(/\n\n+|\r\n\r\n+/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                            signatory: {
                              name: signName || null,
                              title: signTitle || null,
                              phone: signPhone || null,
                            },
                          }
                        : null,
                      notes: (notes || [])
                        .filter((n) => n.trim())
                        .map((n) => n.trim()),
                      work_schedule:
                        workRows.length > 0
                          ? {
                              rows: workRows.map((r) => ({
                                scope: r.scope,
                                details: r.details,
                                timeline: r.timeline,
                              })),
                            }
                          : null,
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
