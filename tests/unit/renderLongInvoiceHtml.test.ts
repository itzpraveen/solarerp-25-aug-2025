import { renderLongInvoiceHtml } from '@/lib/renderLongInvoiceHtml';

describe('renderLongInvoiceHtml', () => {
  it('renders title and totals', () => {
    const html = renderLongInvoiceHtml({
      company: { name: 'Test Co' },
      customer: { name: 'Alice' },
      meta: { quoteNo: 'Q1', dateISO: '2025-01-01', program: 'Commercial', systemCategory: 'On-grid', capacityKW: 1 },
      money: { currency: 'INR', projectCost: 1000, addOns: [{ label: 'X', amount: 100 }], taxRatePct: 18 },
      pipeline: {},
    } as any);
    expect(html).toContain('Q1 - Alice');
    expect(html).toContain('GRAND TOTAL');
  });
});
