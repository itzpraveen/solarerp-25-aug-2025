export type LongInvoiceData = {
  company: { name: string; logoUrl?: string; address?: string; phone?: string; email?: string; upi?: string };
  customer: { name: string; phone?: string; email?: string; address?: string; place?: string };
  meta: {
    quoteNo: string; dateISO: string; validTillISO?: string;
    program: 'PM Surya' | 'Commercial';
    systemCategory: 'On-grid' | 'Hybrid' | 'Off-grid' | 'Inverter & Battery' | 'Solar Water Heater';
    plantBrand?: string; capacityKW: number; site?: string;
  };
  money: {
    currency: 'INR';
    projectCost: number;
    addOns: { label: string; amount: number }[];
    taxRatePct: number;
  };
  pipeline: {
    leadAt?: string; followUpAt?: string; quotedAt?: string; wonAt?: string;
    ksebSubmittedAt?: string; installedAt?: string; netMeteredAt?: string; handoverAt?: string; closedAt?: string;
    reminders?: { label: string; dueISO: string }[];
  };
  kit?: { name?: string; items?: { name: string; qty: string; make?: string }[] };
  boq?: { rows: { item: string; qty: string; unit?: string; make?: string; notes?: string }[] };
  assumptions?: string[];
  warranty?: string[];
  priceSchedule?: { lines: { label: string; amount?: number; note?: string }[]; offerValidityDays?: number };
  paymentTerms?: string[];
  bank?: { accountName?: string; accountNo?: string; ifsc?: string; bank?: string; branch?: string };
  signatures?: { preparedBy?: string; contactPerson?: string; contactNumber?: string };
  malayalamNote?: string;
};

export function renderLongInvoiceHtml(data: LongInvoiceData) {
  const inr = (v?: number) =>
    typeof v === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v) : '';

  const subtotal =
    (data.money.projectCost || 0) + (data.money.addOns?.reduce((s, a) => s + (a.amount || 0), 0) || 0);
  const tax = subtotal * ((data.money.taxRatePct || 0) / 100);
  const grandTotal = subtotal + tax;

  const timelineRow = (label: string, dt?: string) =>
    `<tr><td>${label}</td><td>${dt ? new Date(dt).toLocaleDateString('en-IN') : '-'}</td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${data.meta.quoteNo} - ${data.customer.name}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', Arial; color: #111; }
  h1,h2,h3 { margin: 0.2rem 0 0.4rem; }
  .muted { color: #555; }
  .grid { display: grid; gap: 8px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
  .right { text-align: right; }
  .tag { display:inline-block; padding:2px 8px; border:1px solid #888; border-radius: 999px; font-size: 12px; }
  .page-break { page-break-before: always; }
  .kicker { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: #666; margin-bottom: 4px; }
  .accent { background: #f6f8ff; border-color: #c9d2ff; }
  .header { border: 1px solid #c9d2ff; border-radius: 10px; padding: 12px; background: linear-gradient(180deg, #f6f8ff 0%, #ffffff 100%); }
  footer { position: fixed; bottom: -10mm; left: 0; right: 0; font-size: 11px; color:#666; text-align:center; }
</style>
</head>
<body>

<section class="header">
  <div class="row">
    <div>
      <div class="kicker">Quotation / ക്വോട്ടേഷൻ</div>
      <h1>${data.company.name || ''}</h1>
      <div class="muted">${data.company.address || ''}</div>
      <div class="muted">${data.company.phone || ''} ${data.company.email ? ' | ' + data.company.email : ''}</div>
    </div>
    <div>${data.company.logoUrl ? `<img src="${data.company.logoUrl}" style="max-height:64px;"/>` : ''}</div>
  </div>
  <hr />
  <div class="grid" style="grid-template-columns: 1fr 1fr;">
    <div class="card accent">
      <strong>CLIENT / ഉപഭോക്താവ്</strong>: ${data.customer.name}<br/>
      <strong>PLACE / സ്ഥലം</strong>: ${data.customer.place || ''}<br/>
      <strong>PLANT / ബ്രാൻഡ്</strong>: ${data.meta.plantBrand || ''}<br/>
      <strong>CAPACITY / ശേഷി</strong>: ${data.meta.capacityKW} kW
    </div>
    <div>
      <div><strong>Quote No</strong>: ${data.meta.quoteNo}</div>
      <div><strong>Date</strong>: ${new Date(data.meta.dateISO).toLocaleDateString('en-IN')}</div>
      ${data.meta.validTillISO ? `<div><strong>Valid till</strong>: ${new Date(data.meta.validTillISO).toLocaleDateString('en-IN')}</div>` : ''}
      <div class="row" style="margin-top:6px; gap:6px;">
        <span class="tag">${data.meta.program}</span>
        <span class="tag">${data.meta.systemCategory}</span>
        ${data.kit?.name ? `<span class="tag">${data.kit.name}</span>` : ''}
      </div>
    </div>
  </div>
</section>

<section class="page-break card">
  <h2>Estimate (ചെലവ്)</h2>
  <table class="table">
    <thead><tr><th>Description</th><th class="right">Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td><strong>Project Cost</strong></td><td class="right">${inr(data.money.projectCost)}</td></tr>
      ${data.money.addOns?.map(a => `<tr><td>${a.label}</td><td class="right">${inr(a.amount)}</td></tr>`).join('') || ''}
      <tr><td class="right"><em>Sub‑total</em></td><td class="right"><em>${inr(subtotal)}</em></td></tr>
      <tr><td class="right">Tax (${data.money.taxRatePct || 0}%)</td><td class="right">${inr(tax)}</td></tr>
      <tr><td><strong>GRAND TOTAL</strong></td><td class="right"><strong>${inr(grandTotal)}</strong></td></tr>
    </tbody>
  </table>
  ${data.malayalamNote ? `<p class="muted" style="margin-top:10px;">${data.malayalamNote}</p>` : ''}
</section>

<section class="page-break card">
  <h2>Project Timeline (സമയരേഖ)</h2>
  <table class="table">
    <tbody>
      ${timelineRow('Lead', data.pipeline.leadAt)}
      ${timelineRow('Follow‑up', data.pipeline.followUpAt)}
      ${timelineRow('Quotation', data.pipeline.quotedAt)}
      ${timelineRow('Won', data.pipeline.wonAt)}
      ${timelineRow('KSEB Submitted', data.pipeline.ksebSubmittedAt)}
      ${timelineRow('Installed', data.pipeline.installedAt)}
      ${timelineRow('Net‑Metered', data.pipeline.netMeteredAt)}
      ${timelineRow('Handover', data.pipeline.handoverAt)}
      ${timelineRow('Closed', data.pipeline.closedAt)}
    </tbody>
  </table>
  ${data.pipeline.reminders?.length ? `<h3>Reminders</h3>
  <ul>${data.pipeline.reminders.map(r => `<li>${r.label} — ${new Date(r.dueISO).toLocaleDateString('en-IN')}</li>`).join('')}</ul>` : ''}
</section>

${data.boq?.rows?.length ? `
<section class="page-break card">
  <h2>Bill of Quantities (BOQ / വസ്തു പട്ടിക)</h2>
  <table class="table">
    <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Make</th><th>Notes</th></tr></thead>
    <tbody>
      ${data.boq.rows.map(r => `<tr>
        <td>${r.item}</td><td>${r.qty}</td><td>${r.unit || ''}</td><td>${r.make || ''}</td><td>${r.notes || ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>` : ''}

<section class="page-break card">
  <h2>Assumptions (അവകാശവാദങ്ങൾ)</h2>
  <ul>${(data.assumptions || []).map(x => `<li>${x}</li>`).join('')}</ul>
  ${data.warranty?.length ? `<h2>Warranty (വാറന്റി)</h2><ul>${data.warranty.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
</section>

<section class="page-break card">
  <h2>Price Schedule & Terms (വില പട്ടികയും നിബന്ധനകളും)</h2>
  ${data.priceSchedule?.lines?.length ? `
  <table class="table">
    <thead><tr><th>Line</th><th class="right">Amount</th><th>Notes</th></tr></thead>
    <tbody>
      ${data.priceSchedule.lines.map(l => `<tr><td>${l.label}</td><td class="right">${inr(l.amount)}</td><td>${l.note || ''}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}
  ${data.paymentTerms?.length ? `<h3>Payment Terms</h3><ul>${data.paymentTerms.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
  ${data.bank ? `<h3>Bank / UPI</h3>
    <p><strong>Account Name:</strong> ${data.bank.accountName || ''}<br/>
    <strong>Account No:</strong> ${data.bank.accountNo || ''}<br/>
    <strong>IFSC:</strong> ${data.bank.ifsc || ''}<br/>
    <strong>Bank:</strong> ${data.bank.bank || ''} ${data.bank.branch ? ' | ' + data.bank.branch : ''}<br/>
    ${data.company.upi ? `<strong>UPI:</strong> ${data.company.upi}` : ''}</p>` : ''}
  <p class="muted">Offer validity: ${data.priceSchedule?.offerValidityDays ?? 10} days from date of quotation.</p>
  ${data.signatures ? `<div class="row"><div>
      <div class="kicker">Prepared By</div>
      <div>${data.signatures.preparedBy || ''}</div>
      <div>${data.signatures.contactPerson || ''} ${data.signatures.contactNumber ? ' | ' + data.signatures.contactNumber : ''}</div>
  </div></div>` : ''}
</section>

<footer>${data.company.name} • ${data.company.phone || ''} • ${data.company.email || ''}</footer>
</body>
</html>`;
}
