'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { getCurrentProfile } from '@/lib/currentProfile';
import type { LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import PdfProposalImport, { type ParsedProposalHint } from 'components/PdfProposalImport';
import PageHeader from '~/components/ui/PageHeader';
import { useToast } from '~/components/ui/ToastProvider';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});

type ProposalFlowKind = 'existing-job' | 'lead-job' | 'pdf-only';

type ProposalFlow = {
  kind: ProposalFlowKind;
  description: string;
  detail: string;
  targetJobId?: string;
  lead?: any;
  phone?: string | null;
  customerName?: string;
  nextHref?: string;
  nextLabel?: string;
};

type ValidationIssue = {
  field: string;
  message: string;
};

type GenerationResult = {
  kind: ProposalFlowKind;
  title: string;
  description: string;
  targetLabel: string;
  nextHref?: string;
  nextLabel?: string;
  phone?: string | null;
  proposalId?: string | null;
  targetJobId?: string | null;
};

export default function NewProposalClient() {
  const params = useSearchParams();
  const jobId = params.get('jobId');
  const supabase = supabaseBrowser();
  const { toast } = useToast();
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
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(
    null,
  );
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [quoteNoEdited, setQuoteNoEdited] = useState(false);
  const [validTillEdited, setValidTillEdited] = useState(false);

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

  const resolvedLead = useMemo(
    () => leads.find((lead) => lead.id === leadId) || null,
    [leads, leadId],
  );

  const computedAddOns = useMemo(
    () => [
      ...addOns,
      ...(quotationType === 'Provisional' && (Number(bufferPct) || 0) > 0
        ? [
            {
              label: `Uncertainty buffer (${Number(bufferPct)}%)`,
              amount: Math.round(
                ((Number(price) || 0) * Number(bufferPct)) / 100,
              ),
            },
          ]
        : []),
    ],
    [addOns, bufferPct, price, quotationType],
  );

  const totals = useMemo(() => {
    const beforeTax =
      (Number(price) || 0) +
      computedAddOns.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmt = (beforeTax * (Number(taxRate) || 0)) / 100;
    return {
      beforeTax,
      taxAmt,
      total: beforeTax + taxAmt,
    };
  }, [computedAddOns, price, taxRate]);

  const proposalFlow = useMemo<ProposalFlow>(() => {
    if (jobId) {
      return {
        kind: 'existing-job',
        description: `Generate the PDF and attach it to the existing job${customer?.name ? ` for ${customer.name}` : ''}.`,
        detail:
          'The proposal stays linked to the current job so the sales and execution teams see the same record.',
        targetJobId: jobId,
        phone: customer?.phone || null,
        customerName: customer?.name || 'Existing customer',
        nextHref: `/jobs/${jobId}?tab=proposals`,
        nextLabel: 'Open job proposals',
      };
    }

    if (resolvedLead) {
      return {
        kind: 'lead-job',
        description: `Generate the PDF, create a job from ${resolvedLead.name || 'the selected lead'}, and attach the proposal automatically.`,
        detail:
          'Customer and job records will be created only if needed, and the lead will be moved to Quoted once the proposal is saved.',
        lead: resolvedLead,
        phone: resolvedLead.phone || null,
        customerName: resolvedLead.name || 'Selected lead',
      };
    }

    return {
      kind: 'pdf-only',
      description: 'Generate a standalone quotation PDF without creating a job.',
      detail:
        'Select a lead if you want one click to create the customer, create the job, and save the proposal after the PDF is ready.',
      phone: customer?.phone || null,
      customerName: customer?.name || 'Standalone quotation',
    };
  }, [customer?.name, customer?.phone, jobId, resolvedLead]);

  const flowPreview = useMemo(
    () => ({
      customerName:
        customer?.name || resolvedLead?.name || 'Customer will be added later',
      phone: customer?.phone || resolvedLead?.phone || 'No phone captured yet',
      site: job?.location || resolvedLead?.address || 'Site not added yet',
      capacity:
        job?.capacity_kw || resolvedLead?.interested_capacity_kw || null,
    }),
    [customer?.name, customer?.phone, job?.capacity_kw, job?.location, resolvedLead],
  );

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = [];

    if (!tenantId) {
      issues.push({
        field: 'profile',
        message: 'Your profile is still loading. Wait a moment and try again.',
      });
    }
    if (!kitName) {
      issues.push({
        field: 'kit',
        message: 'Select a kit before generating the quotation.',
      });
    }
    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      issues.push({
        field: 'price',
        message: 'Project cost must be 0 or greater.',
      });
    }
    if (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0 || Number(taxRate) > 100) {
      issues.push({
        field: 'taxRate',
        message: 'Tax percentage must stay between 0 and 100.',
      });
    }
    if (!quoteNo.trim()) {
      issues.push({
        field: 'quoteNo',
        message: 'Enter a quote number so the PDF and saved record stay traceable.',
      });
    }
    if (!validTill) {
      issues.push({
        field: 'validTill',
        message: 'Choose a validity date for the quotation.',
      });
    }
    if (proposalFlow.kind === 'existing-job' && !job) {
      issues.push({
        field: 'job',
        message: 'The selected job is still loading. Wait for the job details to appear.',
      });
    }
    if (includeCover && !coverParagraphs.trim()) {
      issues.push({
        field: 'coverParagraphs',
        message: 'Add at least one cover paragraph or turn off the cover page.',
      });
    }

    return issues;
  }, [
    coverParagraphs,
    includeCover,
    job,
    kitName,
    price,
    proposalFlow.kind,
    quoteNo,
    taxRate,
    tenantId,
    validTill,
  ]);

  const issueMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of validationIssues) {
      if (!map[issue.field]) map[issue.field] = issue.message;
    }
    return map;
  }, [validationIssues]);

  const primaryActionLabel = useMemo(() => {
    if (generating) return progressLabel || 'Generating PDF…';
    if (proposalFlow.kind === 'existing-job') return 'Generate & Save Proposal';
    if (proposalFlow.kind === 'lead-job') return 'Generate, Create Job & Attach';
    return 'Generate PDF';
  }, [generating, progressLabel, proposalFlow.kind]);

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
        let { profile } = await getCurrentProfile<{ tenant_id: string }>(
          supabase as any,
          'tenant_id',
        );
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
  }, [kitName, supabase]);

  useEffect(() => {
    // Default quote number using settings template without overwriting manual edits.
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
    if (!quoteNoEdited || !quoteNo.trim()) {
      setQuoteNo(`${prefix}${body}`);
    }
    const v = new Date();
    v.setDate(v.getDate() + 10);
    if (!validTillEdited || !validTill) {
      setValidTill(v.toISOString().slice(0, 10));
    }
  }, [customer, job, quoteNo, quoteNoEdited, settings, validTill, validTillEdited]);

  useEffect(() => {
    if (jobId || !resolvedLead) return;
    setCustomer((current) => ({
      ...(current || {}),
      name: resolvedLead.name || current?.name || '',
      phone: resolvedLead.phone || current?.phone || '',
      address: resolvedLead.address || current?.address || '',
    }));
    setJob((current) => ({
      ...(current || {}),
      location: resolvedLead.address || current?.location || '',
      capacity_kw:
        resolvedLead.interested_capacity_kw || current?.capacity_kw || 0,
      system_type: current?.system_type || 'On-grid',
    }));
  }, [jobId, resolvedLead]);

  const buildProposalRow = (targetJobId: string, key: string) => {
    const cleanParagraphs = coverParagraphs
      .split(/\n\n+|\r\n\r\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const cleanNotes = (notes || []).filter((n) => n.trim()).map((n) => n.trim());
    const cleanWorkRows = workRows
      .filter((r) => (r.scope || r.details || r.timeline).trim())
      .map((r) => ({
        scope: r.scope,
        details: r.details,
        timeline: r.timeline,
      }));

    return {
      tenant_id: tenantId,
      job_id: targetJobId,
      date: new Date().toISOString().slice(0, 10),
      kit_name: kitName,
      price_before_tax: totals.beforeTax,
      tax: totals.taxAmt,
      total: totals.total,
      pdf_url: key,
      lang,
      quotation_type: quotationType,
      valid_till: validTill || null,
      cover: includeCover
        ? {
            to: coverTo || null,
            subject: coverSubject || null,
            reference: coverReference || null,
            paragraphs: cleanParagraphs,
            signatory: {
              name: signName || null,
              title: signTitle || null,
              phone: signPhone || null,
            },
          }
        : null,
      notes: cleanNotes,
      work_schedule:
        cleanWorkRows.length > 0
          ? {
              rows: cleanWorkRows,
            }
          : null,
    };
  };

  const persistProposalRow = async (targetJobId: string, key: string) => {
    const fullRow: any = buildProposalRow(targetJobId, key);
    const { data, error } = await supabase
      .from('proposals')
      .insert(fullRow)
      .select('id, total, pdf_url')
      .single();
    if (!error) return data;

    const { data: fallback, error: fallbackError } = await supabase
      .from('proposals')
      .insert({
        tenant_id: tenantId,
        job_id: targetJobId,
        date: new Date().toISOString().slice(0, 10),
        kit_name: kitName,
        price_before_tax: totals.beforeTax,
        tax: totals.taxAmt,
        total: totals.total,
        pdf_url: key,
      })
      .select('id, total, pdf_url')
      .single();
    if (fallbackError) throw fallbackError;
    return fallback;
  };

  const ensureCustomerForLead = async (targetTenantId: string, lead: any) => {
    if (lead?.phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', targetTenantId)
        .eq('phone', lead.phone)
        .maybeSingle();
      if (existing?.id) return existing.id as string;
    }

    const { data: customerRow, error } = await supabase
      .from('customers')
      .insert({
        tenant_id: targetTenantId,
        name: lead?.name || 'Customer',
        phone: lead?.phone || null,
        address: lead?.address || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return (customerRow as any).id as string;
  };

  const createJobFromLead = async (lead: any) => {
    const customerId = await ensureCustomerForLead(tenantId, lead);
    const today = new Date().toISOString().slice(0, 10);
    const { data: createdJob, error } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        lead_id: lead.id,
        branch_id: lead?.branch_id || null,
        system_type: job?.system_type || 'On-grid',
        program_type: program,
        status: 'Quoted',
        capacity_kw: lead?.interested_capacity_kw || job?.capacity_kw || null,
        quoted_price: totals.beforeTax,
        total_amount: totals.total,
        location: lead?.address || job?.location || null,
        notes: lead?.notes || job?.notes || null,
        date_lead: (lead as any)?.date || today,
        date_quote: today,
      })
      .select('*')
      .single();
    if (error) throw error;
    return createdJob as any;
  };

  const recordProposalAudit = async (targetJobId: string, proposal: any) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: (user?.user as any)?.id || null,
        action: 'proposals.create',
        entity: 'jobs',
        entity_id: targetJobId,
        metadata: {
          proposalId: proposal?.id,
          total: proposal?.total,
          pdfKey: proposal?.pdf_url,
        },
      });
    } catch {}
  };

  const finalizeProposalForFlow = async (key: string, flow: ProposalFlow) => {
    if (flow.kind === 'pdf-only') {
      return null;
    }

    if (flow.kind === 'existing-job' && flow.targetJobId) {
      setProgressLabel('Saving proposal…');
      const proposal = await persistProposalRow(flow.targetJobId, key);
      await recordProposalAudit(flow.targetJobId, proposal);
      return {
        proposal,
        targetJobId: flow.targetJobId,
        nextHref: flow.nextHref,
        nextLabel: flow.nextLabel,
      };
    }

    if (!flow.lead) {
      throw new Error('Select a lead before trying to create a job from the quotation.');
    }

    setProgressLabel('Creating job…');
    const createdJob = await createJobFromLead(flow.lead);
    setProgressLabel('Saving proposal…');
    const proposal = await persistProposalRow((createdJob as any).id, key);
    await recordProposalAudit((createdJob as any).id, proposal);
    await supabase.from('leads').update({ status: 'Quoted' }).eq('id', flow.lead.id);

    return {
      proposal,
      targetJobId: (createdJob as any).id as string,
      nextHref: `/jobs/${(createdJob as any).id}?tab=proposals`,
      nextLabel: 'Open new job',
    };
  };

  const handleCopyPdfLink = async () => {
    if (!signedUrl) return;
    try {
      await navigator.clipboard.writeText(signedUrl);
      toast({
        title: 'Link copied',
        description: 'The PDF link is ready to paste.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Copy failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    }
  };

  const handleSendWhatsapp = async () => {
    const phone = generationResult?.phone || proposalFlow.phone;
    if (!signedUrl || !phone) return;

    setSendingWhatsapp(true);
    try {
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
            generationResult?.targetLabel || proposalFlow.customerName || 'Customer',
            String(job?.capacity_kw || flowPreview.capacity || ''),
            signedUrl,
          ],
        }),
      });
      if (!res.ok) throw new Error('WhatsApp send failed');
      toast({
        title: 'WhatsApp queued',
        description: 'Proposal share has been queued.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'WhatsApp failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const generate = async () => {
    setSubmitAttempted(true);
    setGenerationResult(null);
    setErrorMsg(null);

    if (validationIssues.length) {
      setErrorMsg(
        `Fix ${validationIssues.length} issue${validationIssues.length > 1 ? 's' : ''} before generating the quotation.`,
      );
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
    setProgressLabel('Generating PDF…');
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
      const saved = await finalizeProposalForFlow(out.key, proposalFlow);
      const result: GenerationResult =
        proposalFlow.kind === 'existing-job'
          ? {
              kind: proposalFlow.kind,
              title: 'Proposal saved to the job',
              description:
                'The quotation PDF is ready and the proposal record is attached to the existing job.',
              targetLabel: proposalFlow.customerName || 'Existing job',
              nextHref: saved?.nextHref,
              nextLabel: saved?.nextLabel,
              phone: proposalFlow.phone,
              proposalId: (saved?.proposal as any)?.id || null,
              targetJobId: saved?.targetJobId || null,
            }
          : proposalFlow.kind === 'lead-job'
            ? {
                kind: proposalFlow.kind,
                title: 'Job created and proposal attached',
                description:
                  'The lead is now quoted, the new job has been created, and the proposal is already linked to it.',
                targetLabel: proposalFlow.customerName || 'Selected lead',
                nextHref: saved?.nextHref,
                nextLabel: saved?.nextLabel,
                phone: proposalFlow.phone,
                proposalId: (saved?.proposal as any)?.id || null,
                targetJobId: saved?.targetJobId || null,
              }
            : {
                kind: proposalFlow.kind,
                title: 'Quotation PDF ready',
                description:
                  'The PDF was generated without creating a job. Select a lead next time if you want the quotation to attach automatically.',
                targetLabel: 'Standalone PDF only',
                phone: proposalFlow.phone,
                proposalId: null,
                targetJobId: null,
              };

      setGenerationResult(result);
      toast({
        title: result.title,
        description: result.description,
        variant: 'success',
      });
    } catch (e: any) {
      setErrorMsg(String(e?.message || e));
    } finally {
      setGenerating(false);
      setProgressLabel('');
    }
  };

  const selectedKit = useMemo(
    () => kits.find((k) => k.kit_name === kitName),
    [kits, kitName],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Proposal"
        subtitle="Build a quote and generate a PDF."
      />
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
                if (p.quoteNo) {
                  setQuoteNoEdited(true);
                  setQuoteNo(p.quoteNo);
                }
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
            No Job selected. You can still generate a PDF. If you pick a lead,
            the main action will generate the quotation, create the job, and
            attach the proposal in one step.
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
          </div>
        )}
        <div className="rounded border bg-slate-50 p-3 text-sm text-slate-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-medium text-slate-900">Action flow</div>
              <div className="mt-1">{proposalFlow.description}</div>
              <div className="mt-1 text-slate-600">{proposalFlow.detail}</div>
            </div>
            <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              {proposalFlow.kind === 'existing-job'
                ? 'Existing job flow'
                : proposalFlow.kind === 'lead-job'
                  ? 'Lead to job flow'
                  : 'Standalone PDF flow'}
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <div>
              <div className="text-slate-500">Customer</div>
              <div className="font-medium text-slate-900">
                {flowPreview.customerName}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Phone</div>
              <div className="font-medium text-slate-900">{flowPreview.phone}</div>
            </div>
            <div>
              <div className="text-slate-500">Site</div>
              <div className="font-medium text-slate-900">{flowPreview.site}</div>
            </div>
            <div>
              <div className="text-slate-500">Capacity</div>
              <div className="font-medium text-slate-900">
                {flowPreview.capacity ? `${flowPreview.capacity} kW` : 'Not added yet'}
              </div>
            </div>
          </div>
          {submitAttempted && validationIssues.length > 0 && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-red-700">
              <div className="font-medium">
                Fix these items before generating the quotation:
              </div>
              <ul className="mt-2 list-disc pl-5">
                {validationIssues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
            className={`mt-1 w-full rounded px-3 py-2 ${
              issueMap.kit ? 'border-red-300 bg-red-50' : 'border'
            }`}
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
          {issueMap.kit && (
            <p className="mt-1 text-xs text-red-600">{issueMap.kit}</p>
          )}
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
                if (!quoteNo) {
                  setQuoteNoEdited(true);
                  setQuoteNo('q19_5KW_SOLAR PLANT_Harilal Mampad');
                }
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
            className={`mt-1 w-full rounded px-3 py-2 ${
              issueMap.price ? 'border-red-300 bg-red-50' : 'border'
            }`}
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
          {issueMap.price && (
            <p className="mt-1 text-xs text-red-600">{issueMap.price}</p>
          )}
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
            className={`mt-1 w-full rounded px-3 py-2 ${
              issueMap.taxRate ? 'border-red-300 bg-red-50' : 'border'
            }`}
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
          {issueMap.taxRate && (
            <p className="mt-1 text-xs text-red-600">{issueMap.taxRate}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Quote No</label>
            <input
              className={`mt-1 w-full rounded px-3 py-2 ${
                issueMap.quoteNo ? 'border-red-300 bg-red-50' : 'border'
              }`}
              value={quoteNo}
              onChange={(e) => {
                setQuoteNoEdited(true);
                setQuoteNo(e.target.value);
              }}
            />
            {issueMap.quoteNo && (
              <p className="mt-1 text-xs text-red-600">{issueMap.quoteNo}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Valid Till</label>
            <input
              className={`mt-1 w-full rounded px-3 py-2 ${
                issueMap.validTill ? 'border-red-300 bg-red-50' : 'border'
              }`}
              type="date"
              value={validTill}
              onChange={(e) => {
                setValidTillEdited(true);
                setValidTill(e.target.value);
              }}
            />
            {issueMap.validTill && (
              <p className="mt-1 text-xs text-red-600">{issueMap.validTill}</p>
            )}
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
                  className={`mt-1 h-28 w-full rounded px-3 py-2 ${
                    issueMap.coverParagraphs ? 'border-red-300 bg-red-50' : 'border'
                  }`}
                  value={coverParagraphs}
                  onChange={(e) => setCoverParagraphs(e.target.value)}
                />
                {issueMap.coverParagraphs && (
                  <p className="mt-1 text-xs text-red-600">
                    {issueMap.coverParagraphs}
                  </p>
                )}
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
          {currencyFormatter.format(
            kitBoq.reduce(
              (s, r) => s + Number(r.mrp || 0) * Number(r.qty || 0),
              0,
            ),
          )}
        </div>
        <div className="rounded border bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-900">Quotation summary</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-slate-600">Project cost</div>
              <div className="font-medium">{currencyFormatter.format(Number(price) || 0)}</div>
            </div>
            <div>
              <div className="text-slate-600">Grand total</div>
              <div className="font-medium">{currencyFormatter.format(totals.total || 0)}</div>
            </div>
            <div>
              <div className="text-slate-600">Destination</div>
              <div className="font-medium">{proposalFlow.description}</div>
            </div>
            <div>
              <div className="text-slate-600">Kit + quote</div>
              <div className="font-medium">
                {(kitName || 'No kit')} • {(quoteNo || 'Draft quote')}
              </div>
            </div>
            <div>
              <div className="text-slate-600">Ready to generate</div>
              <div className="font-medium">
                {validationIssues.length === 0
                  ? 'Yes, all required fields look good.'
                  : `${validationIssues.length} item${validationIssues.length > 1 ? 's' : ''} still need attention.`}
              </div>
            </div>
            <div>
              <div className="text-slate-600">After generation</div>
              <div className="font-medium">{proposalFlow.detail}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={generate}
            className="rounded bg-[var(--primary-600)] px-3 py-2 text-white disabled:opacity-50"
            disabled={generating}
          >
            {primaryActionLabel}
          </button>
          <p className="text-xs text-gray-600">
            {proposalFlow.kind === 'pdf-only'
              ? 'This will only generate the PDF. Pick a lead above if you want the quotation to create and save a job automatically.'
              : proposalFlow.detail}
          </p>
        </div>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-semibold">
                {generationResult?.title || 'Last generated quotation'}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {generationResult?.description ||
                  'The latest quotation PDF is ready.'}
              </p>
            </div>
            <div className="rounded border bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {generationResult?.kind === 'existing-job'
                ? 'Attached to existing job'
                : generationResult?.kind === 'lead-job'
                  ? 'Created from selected lead'
                  : 'Standalone PDF'}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div>
              <div className="text-gray-500">Destination</div>
              <div className="font-medium">
                {generationResult?.targetLabel || proposalFlow.customerName}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Proposal ID</div>
              <div className="font-medium">
                {generationResult?.proposalId || 'PDF only'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">PDF key</div>
              <div className="truncate font-medium">{pdfKey || 'Generated now'}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="rounded bg-[var(--primary-600)] px-3 py-2 text-sm text-white"
              target="_blank"
              rel="noreferrer"
              href={signedUrl}
            >
              Open PDF
            </a>
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm"
              onClick={handleCopyPdfLink}
            >
              Copy PDF link
            </button>
            {generationResult?.nextHref && generationResult?.nextLabel && (
              <Link
                className="rounded border px-3 py-2 text-sm"
                href={generationResult.nextHref}
              >
                {generationResult.nextLabel}
              </Link>
            )}
            {(generationResult?.phone || proposalFlow.phone) && (
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                onClick={handleSendWhatsapp}
                disabled={sendingWhatsapp}
              >
                {sendingWhatsapp ? 'Sending WhatsApp…' : 'Send via WhatsApp'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
