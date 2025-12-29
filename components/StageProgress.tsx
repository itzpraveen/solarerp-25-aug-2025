"use client";
import { JOB_STATUSES, type JobStatus, statusLabel } from "@/lib/status";
import Card from "~/components/ui/Card";
import clsx from "clsx";

export default function StageProgress({
  status,
  compact,
  title = "Stage Progress",
}: {
  status: JobStatus | string | undefined | null;
  compact?: boolean;
  title?: string;
}) {
  const list = [...JOB_STATUSES];
  const idx = Math.max(0, list.findIndex((s) => s === status));

  return (
    <Card title={title}>
      <div className={clsx("w-full", compact ? "py-1" : "py-2")}> 
        <ol className={clsx("flex items-center", compact ? "gap-1" : "gap-2")}
          style={{ counterReset: "step" }}
        >
          {list.map((s, i) => {
            const done = i <= idx && idx > -1;
            return (
              <li key={s} className="flex-1 flex items-center gap-2">
                {i !== 0 && (
                  <div
                    className={clsx(
                      "h-1 flex-1 rounded",
                      done ? "bg-[var(--success-500)]" : "bg-[var(--border-subtle)]",
                    )}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      "h-6 w-6 shrink-0 rounded-full text-[10px] flex items-center justify-center border",
                      done
                        ? "bg-[var(--success-500)] border-[var(--success-600)] text-white"
                        : "bg-[var(--bg-surface)] border-[var(--border-strong)] text-[var(--text-tertiary)]",
                    )}
                  >
                    {i + 1}
                  </div>
                  {!compact && (
                    <span
                      className={clsx(
                        "hidden md:inline text-xs",
                        done
                          ? "text-[var(--success-700)]"
                          : "text-[var(--text-secondary)]",
                      )}
                    >
                      {statusLabel(s as JobStatus)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
