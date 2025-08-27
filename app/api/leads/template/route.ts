import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Build a simple template with headers matching the importer
  const headers = [
    [
      'Name',
      'Contact Number',
      'Email',
      'Place',
      'Source',
      'KW',
      'Date',
      'Next Follow-up',
      'Branch',
      'Remarks',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="leads-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
