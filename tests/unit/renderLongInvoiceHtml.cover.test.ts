import { renderLongInvoiceHtml } from '@/lib/renderLongInvoiceHtml';

describe('renderLongInvoiceHtml cover letter', () => {
  it('renders cover letter when provided', () => {
    const html = renderLongInvoiceHtml({
      company: { name: 'Test Co' },
      customer: { name: 'Alice' },
      meta: {
        quoteNo: 'Q2',
        dateISO: '2025-01-01',
        program: 'PM Surya',
        systemCategory: 'On-grid',
        capacityKW: 5,
      },
      money: { currency: 'INR', projectCost: 0, addOns: [], taxRatePct: 0 },
      pipeline: {},
      cover: {
        to: 'Mr Harilal, Mampad',
        subject: 'QUOTATION FOR 5 KW ON GRID SOLAR POWER PLANT (PMSG SUBSIDY)',
        reference: 'Mr Jafar',
        paragraphs: ['We are pleased to submit our quotation.'],
      },
    } as any);
    expect(html).toContain('QUOTATION FOR 5 KW ON GRID SOLAR POWER PLANT');
    expect(html).toContain('Mr Harilal');
    expect(html).toContain('Mr Jafar');
  });
});
