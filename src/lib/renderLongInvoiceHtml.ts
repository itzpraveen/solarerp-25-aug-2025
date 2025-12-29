export type LongInvoiceData = {
  lang?: 'en' | 'ml';
  company: {
    name: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    upi?: string;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    place?: string;
  };
  meta: {
    quoteNo: string;
    dateISO: string;
    validTillISO?: string;
    program: 'PM Surya' | 'Commercial';
    quotationType?: 'Provisional' | 'Final';
    systemCategory:
      | 'On-grid'
      | 'Hybrid'
      | 'Off-grid'
      | 'Inverter & Battery'
      | 'Solar Water Heater';
    plantBrand?: string;
    capacityKW: number;
    site?: string;
  };
  money: {
    currency: 'INR';
    projectCost: number;
    addOns: { label: string; amount: number }[];
    taxRatePct: number;
  };
  pipeline: {
    leadAt?: string;
    followUpAt?: string;
    quotedAt?: string;
    wonAt?: string;
    ksebSubmittedAt?: string;
    installedAt?: string;
    netMeteredAt?: string;
    handoverAt?: string;
    closedAt?: string;
    reminders?: { label: string; dueISO: string }[];
  };
  kit?: {
    name?: string;
    items?: { name: string; qty: string; make?: string }[];
  };
  boq?: {
    rows: {
      item: string;
      qty: string;
      unit?: string;
      make?: string;
      notes?: string;
    }[];
  };
  // Optional cover letter and extra sections for long proposals
  cover?: {
    to?: string;
    subject?: string;
    reference?: string;
    paragraphs?: string[]; // free-form paragraphs
    signatory?: { name?: string; title?: string; phone?: string };
  };
  assumptions?: string[];
  notes?: string[]; // general notes section
  warranty?: string[];
  workSchedule?: {
    rows: { scope: string; details: string; timeline: string }[];
  };
  priceSchedule?: {
    lines: { label: string; amount?: number; note?: string }[];
    offerValidityDays?: number;
  };
  paymentTerms?: string[];
  bank?: {
    accountName?: string;
    accountNo?: string;
    ifsc?: string;
    bank?: string;
    branch?: string;
  };
  signatures?: {
    preparedBy?: string;
    contactPerson?: string;
    contactNumber?: string;
  };
  malayalamNote?: string;
};

export function renderLongInvoiceHtml(data: LongInvoiceData) {
  const lang: 'en' | 'ml' = data.lang === 'ml' ? 'ml' : 'en';
  const L = {
    en: {
      quotation: 'Quotation',
      client: 'Client',
      place: 'Place',
      address: 'Address',
      plant: 'Plant',
      brand: 'Brand',
      capacity: 'Capacity',
      quoteNo: 'Quote No',
      date: 'Date',
      validTill: 'Valid till',
      to: 'To',
      subject: 'Subject',
      reference: 'Reference',
      estimate: 'Estimate',
      description: 'Description',
      amount: 'Amount',
      projectCost: 'Project Cost',
      subtotal: 'Sub‑total',
      tax: 'Tax',
      grandTotal: 'GRAND TOTAL',
      timeline: 'Project Timeline',
      workSchedule: 'Work Schedule',
      lead: 'Lead',
      followUp: 'Follow‑up',
      quoted: 'Quotation',
      won: 'Won',
      ksebSubmitted: 'KSEB Submitted',
      installed: 'Installed',
      netMetered: 'Net‑Metered',
      handover: 'Handover',
      closed: 'Closed',
      reminders: 'Reminders',
      boq: 'Bill of Quantities (BOQ)',
      item: 'Item',
      qty: 'Qty',
      unit: 'Unit',
      make: 'Make',
      notes: 'Notes',
      assumptions: 'Assumptions',
      generalNotes: 'Notes',
      warranty: 'Warranty',
      priceSchedule: 'Price Schedule & Terms',
      line: 'Line',
      paymentTerms: 'Payment Terms',
      bankUpi: 'Bank / UPI',
      accountName: 'Account Name',
      accountNo: 'Account No',
      bank: 'Bank',
      branch: 'Branch',
      offerValidity: 'Offer validity',
      daysFromQuote: 'days from date of quotation.',
      preparedBy: 'Prepared By',
    },
    ml: {
      quotation: 'ക്വോട്ടേഷൻ',
      client: 'ഉപഭോക്താവ്',
      place: 'സ്ഥലം',
      address: 'വിലാസം',
      plant: 'പ്ലാന്റ്',
      brand: 'ബ്രാൻഡ്',
      capacity: 'ശേഷി',
      quoteNo: 'ക്വോട്ട് നമ്പർ',
      date: 'തീയതി',
      validTill: 'കാലാവധി',
      to: 'ആര്‍ക്ക്',
      subject: 'വിഷയം',
      reference: 'റഫറൻസ്',
      estimate: 'ചെലവ്',
      description: 'വിവരണം',
      amount: 'തുക',
      projectCost: 'പ്രോജക്റ്റ് ചെലവ്',
      subtotal: 'ഉപമൊത്തം',
      tax: 'നികുതി',
      grandTotal: 'ആകെ തുക',
      timeline: 'സമയരേഖ',
      workSchedule: 'ജോലി ഷെഡ്യൂൾ',
      lead: 'ലീഡ്',
      followUp: 'ഫോളോ‑അപ്പ്',
      quoted: 'ക്വോട്ടേഷൻ',
      won: 'ജയം',
      ksebSubmitted: 'KSEB സമർപ്പിച്ചു',
      installed: 'സ്ഥാപിച്ചു',
      netMetered: 'നെറ്റ്‑മീറ്റർ',
      handover: 'ഹാൻഡോവർ',
      closed: 'അടച്ചു',
      reminders: 'റിമൈൻഡറുകൾ',
      boq: 'വസ്തു പട്ടിക',
      item: 'ഇനം',
      qty: 'അളവ്',
      unit: 'യൂണിറ്റ്',
      make: 'മെക്ക്',
      notes: 'കുറിപ്പുകൾ',
      assumptions: 'അവകാശവാദങ്ങൾ',
      generalNotes: 'കുറിപ്പുകൾ',
      warranty: 'വാറന്റി',
      priceSchedule: 'വില പട്ടികയും നിബന്ധനകളും',
      line: 'ലൈൻ',
      paymentTerms: 'പേയ്മെന്റ് നിബന്ധനകൾ',
      bankUpi: 'ബാങ്ക് / UPI',
      accountName: 'അക്കൗണ്ട് പേര്',
      accountNo: 'അക്കൗണ്ട് നമ്പർ',
      bank: 'ബാങ്ക്',
      branch: 'ശാഖ',
      offerValidity: 'ഓഫർ സാധുത',
      daysFromQuote: 'ദിവസം (ക്വോട്ടേഷൻ തീയതി മുതൽ).',
      preparedBy: 'തയ്യാറാക്കിയത്',
    },
  } as const;
  const S = L[lang];
  const inr = (v?: number) =>
    typeof v === 'number'
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(v)
      : '';

  const subtotal =
    (data.money.projectCost || 0) +
    (data.money.addOns?.reduce((s, a) => s + (a.amount || 0), 0) || 0);
  const tax = subtotal * ((data.money.taxRatePct || 0) / 100);
  const grandTotal = subtotal + tax;

  // Render multi-line addresses cleanly inside HTML
  const companyAddressHtml = String(data.company.address || '')
    .trim()
    .replace(/\n+/g, '<br/>');
  const customerAddressHtml = String(
    data.customer.address || data.customer.place || data.meta.site || '',
  )
    .trim()
    .replace(/\n+/g, '<br/>');

  const timelineRow = (label: string, dt?: string) =>
    `<tr><td>${label}</td><td>${dt ? new Date(dt).toLocaleDateString('en-IN') : '-'}</td></tr>`;

  const mlFontBase64 = process.env.PDF_ML_FONT_BASE64;
  const devDefaultUrl = `http://localhost:${process.env.PORT || 3000}/fonts/NotoSansMalayalam-Regular.ttf`;
  const mlFontUrl =
    process.env.NEXT_PUBLIC_ML_FONT_URL ||
    (process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/fonts/NotoSansMalayalam-Regular.ttf`
      : undefined) ||
    (process.env.NODE_ENV !== 'production' ? devDefaultUrl : undefined);
  const mlFontCss =
    lang === 'ml'
      ? `@font-face { font-family: 'ML'; src: ${mlFontBase64 ? `url("data:font/ttf;base64,${mlFontBase64}") format("truetype")` : mlFontUrl ? `url("${mlFontUrl}") format("truetype")` : 'local("Noto Sans Malayalam")'}; font-weight: normal; font-style: normal; }
       .ml { font-family: 'ML', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', Arial; }`
      : '';

  const bodyFontCss =
    lang === 'ml'
      ? `.body { font-family: 'ML', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', Arial; }`
      : `.body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', Arial; }`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${data.meta.quoteNo} - ${data.customer.name}</title>
<style>
  ${mlFontCss}
  @page { size: A4; margin: 18mm 14mm; }
  ${bodyFontCss}
  body { color: #111; }
  h1,h2,h3 { margin: 0.2rem 0 0.4rem; }
  .muted { color: #555; }
  .grid { display: grid; gap: 8px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .card { border: 1px solid #e6e8ef; border-radius: 10px; padding: 12px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { border: 1px solid #e6e8ef; padding: 8px; vertical-align: top; }
  .right { text-align: right; }
  .tag { display:inline-block; padding:2px 8px; border:1px solid #b2e4ca; background:#f2fbf6; border-radius: 999px; font-size: 12px; color:#223; }
  .page-break { page-break-before: always; }
  .kicker { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: #666; margin-bottom: 4px; }
  .accent { background: #f2fbf6; border-color: #b2e4ca; }
  .header { border: 1px solid #b2e4ca; border-radius: 12px; padding: 14px; background: linear-gradient(180deg, #f2fbf6 0%, #ffffff 100%); }
  .header-top { align-items: center; }
  .logo { display:flex; align-items:center; justify-content:flex-end; }
  .logo img { max-height: 56px; max-width: 45%; height:auto; width:auto; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
  .summary { border:1px dashed #b2e4ca; border-radius:8px; padding:8px; margin-top:6px; background:#f2fbf6; }
  .summary .row { gap:8px; }
  .summary .label { color:#445; }
  .summary .value { font-weight:600; }
  footer { position: fixed; bottom: 8mm; left: 0; right: 0; font-size: 11px; color:#666; text-align:center; z-index: 0; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); color: rgba(220,0,0,0.10); font-size: 74px; font-weight: 800; z-index: 9999; letter-spacing: 2px; }
</style>
</head>
<body class="body">

${data.meta.quotationType === 'Provisional' ? `<div class="watermark">PROVISIONAL</div>` : ''}
<section class="header">
  <div class="row header-top">
    <div>
      <div class="kicker">${S.quotation}</div>
      <h1>${data.company.name || ''}</h1>
      <div class="muted">${companyAddressHtml}</div>
    </div>
    <div class="logo">${data.company.logoUrl ? `<img src="${data.company.logoUrl}" alt="${(data.company.name || 'Logo').replace(/"/g,'')}">` : ''}</div>
  </div>
  <hr />
  <div class="grid" style="grid-template-columns: 1fr 1fr;">
    <div class="card accent">
      <strong>${S.client}</strong>: ${data.customer.name}<br/>
      <strong>${S.address}</strong>: ${customerAddressHtml}<br/>
      ${
        data.customer.phone || data.customer.email
          ? `<span class="muted">${[data.customer.phone, data.customer.email].filter(Boolean).join(' | ')}</span><br/>`
          : ''
      }
      <strong>${S.plant} / ${S.brand}</strong>: ${data.meta.plantBrand || ''}<br/>
      <strong>${S.capacity}</strong>: ${data.meta.capacityKW} kW
    </div>
    <div>
      <div><strong>${S.quoteNo}</strong>: ${data.meta.quoteNo}</div>
      <div><strong>${S.date}</strong>: ${new Date(data.meta.dateISO).toLocaleDateString('en-IN')}</div>
      ${data.meta.validTillISO ? `<div><strong>${S.validTill}</strong>: ${new Date(data.meta.validTillISO).toLocaleDateString('en-IN')}</div>` : ''}
      <div class="row" style="margin-top:6px; gap:6px;">
        <span class="tag">${data.meta.program}</span>
        <span class="tag">${data.meta.systemCategory}</span>
        ${data.kit?.name ? `<span class="tag">${data.kit.name}</span>` : ''}
        ${data.meta.quotationType ? `<span class="tag">${data.meta.quotationType}</span>` : ''}
      </div>
      <div class="summary">
        <div class="row"><div class="label">${S.projectCost}:</div><div class="value">${inr(data.money.projectCost)}</div></div>
        <div class="row"><div class="label">${S.tax} (${Number(data.money.taxRatePct || 0)}%):</div><div class="value">${inr(tax)}</div></div>
        <div class="row"><div class="label">${S.grandTotal}:</div><div class="value">${inr(grandTotal)}</div></div>
      </div>
    </div>
  </div>
</section>

${
  data.cover
    ? `
<section class="page-break card">
  <h2>${S.quotation}</h2>
  ${data.cover.to ? `<p><strong>${S.to}:</strong> ${data.cover.to}</p>` : ''}
  <p><strong>${S.subject}:</strong> ${data.cover.subject || `Quotation for ${data.meta.capacityKW} kW ${data.meta.systemCategory} Solar Power Plant ${data.meta.program === 'PM Surya' ? '(PMSG Subsidy)' : ''}`}</p>
  ${data.cover.reference ? `<p><strong>${S.reference}:</strong> ${data.cover.reference}</p>` : ''}
  ${(data.cover.paragraphs || []).map((p) => `<p>${p}</p>`).join('')}
  ${
    data.cover.signatory
      ? `<div style="margin-top: 12px;">
    <div>${data.cover.signatory.name || ''}</div>
    <div class="muted">${data.cover.signatory.title || ''}</div>
    ${data.cover.signatory.phone ? `<div class="muted">${data.cover.signatory.phone}</div>` : ''}
  </div>`
      : ''
  }
</section>`
    : ''
}

<section class="page-break card">
  <h2>${S.estimate}</h2>
  <table class="table">
    <thead><tr><th>${S.description}</th><th class="right">${S.amount} (₹)</th></tr></thead>
    <tbody>
      <tr><td><strong>${S.projectCost}</strong></td><td class="right">${inr(data.money.projectCost)}</td></tr>
      ${data.money.addOns?.map((a) => `<tr><td>${a.label}</td><td class="right">${inr(a.amount)}</td></tr>`).join('') || ''}
      <tr><td class="right"><em>${S.subtotal}</em></td><td class="right"><em>${inr(subtotal)}</em></td></tr>
      <tr><td class="right">${S.tax} (${data.money.taxRatePct || 0}%)</td><td class="right">${inr(tax)}</td></tr>
      <tr><td><strong>${S.grandTotal}</strong></td><td class="right"><strong>${inr(grandTotal)}</strong></td></tr>
    </tbody>
  </table>
  ${lang === 'ml' && data.malayalamNote ? `<p class="muted" style="margin-top:10px;">${data.malayalamNote}</p>` : ''}
</section>

<section class="page-break card">
  <h2>${S.timeline}</h2>
  <table class="table">
    <tbody>
      ${timelineRow(S.lead, data.pipeline.leadAt)}
      ${timelineRow(S.followUp, data.pipeline.followUpAt)}
      ${timelineRow(S.quoted, data.pipeline.quotedAt)}
      ${timelineRow(S.won, data.pipeline.wonAt)}
      ${timelineRow(S.ksebSubmitted, data.pipeline.ksebSubmittedAt)}
      ${timelineRow(S.installed, data.pipeline.installedAt)}
      ${timelineRow(S.netMetered, data.pipeline.netMeteredAt)}
      ${timelineRow(S.handover, data.pipeline.handoverAt)}
      ${timelineRow(S.closed, data.pipeline.closedAt)}
    </tbody>
  </table>
  ${
    data.pipeline.reminders?.length
      ? `<h3>${S.reminders}</h3>
  <ul>${data.pipeline.reminders.map((r) => `<li>${r.label} — ${new Date(r.dueISO).toLocaleDateString('en-IN')}</li>`).join('')}</ul>`
      : ''
  }
</section>

${
  data.boq?.rows?.length
    ? `
<section class="page-break card">
  <h2>${S.boq}</h2>
  <table class="table">
    <thead><tr><th>${S.item}</th><th>${S.qty}</th><th>${S.unit}</th><th>${S.make}</th><th>${S.notes}</th></tr></thead>
    <tbody>
      ${data.boq.rows
        .map(
          (r) => `<tr>
        <td>${r.item}</td><td>${r.qty}</td><td>${r.unit || ''}</td><td>${r.make || ''}</td><td>${r.notes || ''}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</section>`
    : ''
}

${
  data.workSchedule?.rows?.length
    ? `
<section class="page-break card">
  <h2>${S.workSchedule}</h2>
  <table class="table">
    <thead><tr><th>Scope</th><th>Details</th><th>Timeline</th></tr></thead>
    <tbody>
      ${data.workSchedule.rows.map((r) => `<tr><td>${r.scope}</td><td>${r.details}</td><td>${r.timeline}</td></tr>`).join('')}
    </tbody>
  </table>
</section>`
    : ''
}

<section class="page-break card">
  <h2>${S.assumptions}</h2>
  <ul>${(data.assumptions || []).map((x) => `<li>${x}</li>`).join('')}</ul>
  ${data.warranty?.length ? `<h2>${S.warranty}</h2><ul>${data.warranty.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
</section>

${
  data.notes && data.notes.length
    ? `
<section class="page-break card">
  <h2>${S.generalNotes}</h2>
  <ul>${data.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
</section>`
    : ''
}

<section class="page-break card">
  <h2>${S.priceSchedule}</h2>
  ${
    data.priceSchedule?.lines?.length
      ? `
  <table class="table">
    <thead><tr><th>${S.line}</th><th class="right">${S.amount}</th><th>${S.notes}</th></tr></thead>
    <tbody>
      ${data.priceSchedule.lines.map((l) => `<tr><td>${l.label}</td><td class="right">${inr(l.amount)}</td><td>${l.note || ''}</td></tr>`).join('')}
    </tbody>
  </table>`
      : ''
  }
  ${data.paymentTerms?.length ? `<h3>${S.paymentTerms}</h3><ul>${data.paymentTerms.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
  ${
    data.bank
      ? `<h3>${S.bankUpi}</h3>
    <p><strong>${S.accountName}:</strong> ${data.bank.accountName || ''}<br/>
    <strong>${S.accountNo}:</strong> ${data.bank.accountNo || ''}<br/>
    <strong>IFSC:</strong> ${data.bank.ifsc || ''}<br/>
    <strong>${S.bank}:</strong> ${data.bank.bank || ''} ${data.bank.branch ? ' | ' + data.bank.branch : ''}<br/>
    ${data.company.upi ? `<strong>UPI:</strong> ${data.company.upi}` : ''}</p>`
      : ''
  }
  <p class="muted">${S.offerValidity}: ${data.priceSchedule?.offerValidityDays ?? 10} ${S.daysFromQuote}</p>
  ${
    data.signatures
      ? `<div class="row"><div>
      <div class="kicker">${S.preparedBy}</div>
      <div>${data.signatures.preparedBy || ''}</div>
      <div>${data.signatures.contactPerson || ''} ${data.signatures.contactNumber ? ' | ' + data.signatures.contactNumber : ''}</div>
  </div></div>`
      : ''
  }
</section>

<footer>${data.company.name} • ${data.company.phone || ''} • ${data.company.email || ''}</footer>
</body>
</html>`;
}
