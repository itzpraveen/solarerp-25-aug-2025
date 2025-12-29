"use client";
import Card from "~/components/ui/Card";
import clsx from "clsx";

type Job = {
  date_lead?: string | null;
  date_site_survey?: string | null;
  date_quote?: string | null;
  date_won?: string | null;
  date_kseb_submit?: string | null;
  date_install?: string | null;
  date_meter?: string | null;
  date_handover?: string | null;
};

const order: Array<[keyof Job, string]> = [
  ["date_lead", "Lead"],
  ["date_site_survey", "Site Survey"],
  ["date_quote", "Quoted"],
  ["date_won", "Won"],
  ["date_kseb_submit", "KSEB Submitted"],
  ["date_install", "Installed"],
  ["date_meter", "Net Metered"],
  ["date_handover", "Handover"],
];

export default function MilestoneTimeline({ job }: { job: Job }) {
  const items = order.map(([k, label]) => ({
    key: k,
    label,
    date: (job as any)?.[k] as string | null | undefined,
  }));
  return (
    <Card title="Timeline">
      <div className="relative pl-3">
        <div className="absolute left-[6px] top-0 bottom-0 w-[2px] bg-[var(--border-subtle)]" />
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={String(it.key)} className="relative flex items-center gap-3">
              <div
                className={clsx(
                  "h-3 w-3 rounded-full border",
                  it.date
                    ? "bg-[var(--success-500)] border-[var(--success-600)]"
                    : "bg-[var(--bg-surface)] border-[var(--border-strong)]",
                )}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{it.label}</span>
                <span className="text-xs text-[var(--text-secondary)]">{it.date || "—"}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
