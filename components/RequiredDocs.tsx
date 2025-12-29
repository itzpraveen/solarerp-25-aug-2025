"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "~/components/ui/Card";
import clsx from "clsx";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { JobStatus } from "@/lib/status";

type DocRow = { id: string; doc_type: string | null };

const REQUIRED_BY_STAGE: Record<JobStatus | string, string[]> = {
  Lead: [],
  Qualified: ["site-survey"],
  Quoted: [],
  Won: [],
  KSEB_Submitted: ["kseb-application"],
  Material_Ordered: [],
  Installed: ["install-photos"],
  Net_Metered: [],
  Handover: ["handover"],
  Closed: [],
  Lost: [],
};

export default function RequiredDocs({ jobId, status }: { jobId: string; status: JobStatus | string | null | undefined }) {
  const supabase = supabaseBrowser();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, doc_type")
      .eq("job_id", jobId);
    setDocs((data as any) || []);
  }, [jobId, supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const req = REQUIRED_BY_STAGE[String(status || "Lead")] || [];
  const have = useMemo(() => new Set(docs.map((d) => String(d.doc_type || ""))), [docs]);
  const missing = req.filter((r) => !have.has(r));

  return (
    <Card title="Required Items" actions={<a className="text-xs text-[var(--primary-600)]" href={`?tab=docs`}>Docs</a>}>
      {req.length === 0 ? (
        <div className="text-sm text-gray-600">No required documents for this stage.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {req.map((r) => (
            <li key={r} className="flex items-center gap-2">
              <span
                className={clsx(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                  have.has(r)
                    ? "bg-emerald-500 border-emerald-600 text-white"
                    : "bg-white border-gray-300 text-gray-600 dark:bg-gray-900 dark:border-gray-700",
                )}
              >
                {have.has(r) ? "✓" : "!"}
              </span>
              <span className={have.has(r) ? "text-gray-700" : "text-gray-800"}>{labelFor(r)}</span>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="mt-2 text-xs text-amber-700">
          Missing: {missing.map(labelFor).join(", ")}
        </div>
      )}
    </Card>
  );
}

function labelFor(code: string) {
  switch (code) {
    case "kseb-application":
      return "KSEB Application";
    case "site-survey":
      return "Site Survey Report";
    case "install-photos":
      return "Installation Photos";
    case "handover":
      return "Handover Form";
    default:
      return code;
  }
}
