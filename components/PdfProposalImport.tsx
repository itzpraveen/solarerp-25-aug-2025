"use client";
import { useEffect, useMemo, useState } from "react";

export type ParsedProposalHint = {
  capacityKW?: number;
  systemType?: string;
  priceBeforeTax?: number;
  program?: "PM_Surya" | "Commercial";
  quoteNo?: string;
  customerName?: string;
  place?: string;
  notes?: string[];
  rawText?: string;
};

function parseINR(input: string): number | undefined {
  const s = (input || "").replace(/[^0-9.]/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error -- worker shipped by pdfjs-dist
  const workerSrc = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (workerSrc as any).default || workerSrc;

  const uint8 = new Uint8Array(await file.arrayBuffer());
  const doc = await (pdfjs as any).getDocument({ data: uint8 }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((i: any) => i.str).join("\n");
    lines.push(pageText);
  }
  return lines.join("\n");
}

function simpleParse(text: string, fileName?: string): ParsedProposalHint {
  const t = text.replace(/\u00A0/g, " "); // NBSP -> space
  const out: ParsedProposalHint = { rawText: t };

  // Capacity: first occurrence like 5 KW or 5kW
  const kwMatch = t.match(/(\d+(?:\.\d+)?)\s*(kW|KW)\b/);
  if (kwMatch) out.capacityKW = Number(kwMatch[1]);

  // System type
  if (/on[-\s]?grid/i.test(t)) out.systemType = "On-grid";
  else if (/hybrid/i.test(t)) out.systemType = "Hybrid";
  else if (/off[-\s]?grid/i.test(t)) out.systemType = "Off-grid";

  // Program
  if (/PM\s?Sury|PMSG|PM\s?Surya/i.test(t)) out.program = "PM_Surya";

  // Price: choose the largest currency-like number; prefer lines near TOTAL
  const lines = t.split(/\n+/);
  let best: number | undefined;
  for (const ln of lines) {
    if (!/(total|grand total|amount payable|project cost)/i.test(ln)) continue;
    const nums = ln.match(/₹?\s?[0-9][0-9,\. ]+/g) || [];
    for (const s of nums) {
      const n = parseINR(s);
      if (n && (!best || n > best)) best = n;
    }
  }
  if (best === undefined) {
    // fallback: global max
    const nums = t.match(/₹?\s?[0-9][0-9,\. ]+/g) || [];
    for (const s of nums) {
      const n = parseINR(s);
      if (n && (!best || n > best)) best = n;
    }
  }
  if (best !== undefined) out.priceBeforeTax = best;

  // Quote number: derive from file name if looks like it
  if (fileName) out.quoteNo = fileName.replace(/\.[Pp][Dd][Ff]$/, "");

  // A very rough place guess: look for a capitalized word near kW line
  const idx = lines.findIndex((l) => /(kW|KW)/.test(l));
  if (idx >= 0) {
    const near = [lines[idx - 1], lines[idx], lines[idx + 1]]
      .filter(Boolean)
      .join(" ");
    const place = (near.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?/) || [])[0];
    if (place) out.place = place;
  }

  return out;
}

export default function PdfProposalImport({
  onParsed,
}: {
  onParsed: (p: ParsedProposalHint) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<ParsedProposalHint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setError(null);
    setBusy(true);
    try {
      const text = await extractTextFromPdf(f);
      const parsed = simpleParse(text, f.name);
      setHint(parsed);
      onParsed(parsed);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border p-3">
      <div className="mb-2 text-sm font-medium">Import from PDF (beta)</div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {busy && <div className="mt-2 text-xs text-gray-600">Parsing…</div>}
      {error && (
        <div className="mt-2 rounded border bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {hint && (
        <div className="mt-2 text-xs text-gray-700">
          <div>Detected:</div>
          <ul className="list-inside list-disc space-y-1">
            {hint.capacityKW !== undefined && <li>Capacity: {hint.capacityKW} kW</li>}
            {hint.systemType && <li>System: {hint.systemType}</li>}
            {hint.priceBeforeTax !== undefined && <li>Price: ₹{hint.priceBeforeTax}</li>}
            {hint.program && <li>Program: {hint.program}</li>}
            {hint.quoteNo && <li>Quote: {hint.quoteNo}</li>}
            {hint.place && <li>Place: {hint.place}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
