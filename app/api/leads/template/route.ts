import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Build a simple template with headers matching the importer
  const headers = [
    'Name',
    'Contact Number',
    'Email',
    'Address',
    'Source',
    'KW',
    'Date',
    'Next Follow-up',
    'Branch',
    'Remarks',
  ];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leads');
  ws.addRow(headers);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="leads-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
