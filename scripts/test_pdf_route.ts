#!/usr/bin/env tsx
import { NextRequest } from 'next/server';
import { POST as pdf } from '@/app/api/pdf/invoice/route';

async function main() {
  process.env.E2E_MOCK = '1';
  // Minimal payload based on README, simplified
  const body = {
    tenantId: 't1',
    payload: {
      lang: 'en',
      company: {
        name: 'Demo Co',
        address: 'Kerala',
        phone: '000',
        email: 'demo@example.com',
        upi: 'demo@upi',
      },
      customer: {
        name: 'Test Customer',
        phone: '+910000000000',
        place: 'Kochi',
        address: 'Address',
      },
      meta: {
        quoteNo: 'Q_TEST',
        dateISO: new Date().toISOString(),
        validTillISO: undefined,
        program: 'PM Surya',
        systemCategory: 'On-grid',
        plantBrand: 'Demo',
        capacityKW: 2,
      },
      money: { currency: 'INR', projectCost: 1000, addOns: [], taxRatePct: 0 },
      pipeline: {},
      boq: { rows: [] },
      assumptions: [],
      warranty: [],
      paymentTerms: [],
      priceSchedule: { lines: [], offerValidityDays: 10 },
    },
  };

  const req = new NextRequest(
    new Request('http://localhost/api/pdf/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const res = await pdf(req as any);
  const json = await res.json();
  console.log('PDF route response:', json);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
