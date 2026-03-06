import { renderLongInvoiceHtml } from '@/lib/renderLongInvoiceHtml';

describe('renderLongInvoiceHtml', () => {
  it('renders title and totals', () => {
    const html = renderLongInvoiceHtml({
      company: { name: 'Test Co' },
      customer: { name: 'Alice' },
      meta: {
        quoteNo: 'Q1',
        dateISO: '2025-01-01',
        program: 'Commercial',
        systemCategory: 'On-grid',
        capacityKW: 1,
      },
      money: {
        currency: 'INR',
        projectCost: 1000,
        addOns: [{ label: 'X', amount: 100 }],
        taxRatePct: 18,
      },
      pipeline: {},
    } as any);
    expect(html).toContain('Q1 - Alice');
    expect(html).toContain('GRAND TOTAL');
  });

  it('escapes user-controlled HTML content', () => {
    const html = renderLongInvoiceHtml({
      company: { name: 'Test <b>Co</b>', logoUrl: 'https://cdn.example.com/logo.png?x=1&y=2' },
      customer: { name: 'Alice <script>alert(1)</script>' },
      meta: {
        quoteNo: 'Q<script>2</script>',
        dateISO: '2025-01-01',
        program: 'Commercial',
        systemCategory: 'On-grid',
        capacityKW: 1,
      },
      money: {
        currency: 'INR',
        projectCost: 1000,
        addOns: [{ label: '<img src=x onerror=1>', amount: 100 }],
        taxRatePct: 18,
      },
      pipeline: {},
    } as any);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Alice &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Test &lt;b&gt;Co&lt;/b&gt;');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
    expect(html).toContain('logo.png?x=1&amp;y=2');
  });
});
