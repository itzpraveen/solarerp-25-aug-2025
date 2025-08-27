#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { renderLongInvoiceHtml } from '@/lib/renderLongInvoiceHtml';

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error(
      'Usage: tsx scripts/render_payload_to_html.ts <path-to-json> [out.html]',
    );
    process.exit(1);
  }
  const raw = fs.readFileSync(input, 'utf8');
  const payload = JSON.parse(raw);
  const html = renderLongInvoiceHtml(payload);
  const out = process.argv[3] || path.join('tmp', 'rendered.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('Wrote', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
