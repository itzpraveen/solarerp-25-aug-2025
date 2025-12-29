import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-10 text-center">
      <div className="mb-3 rounded-full bg-[var(--bg-subtle)] p-3 text-[var(--text-muted)]">
        {icon || <Inbox size={28} />}
      </div>
      <div className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </div>
      {description && (
        <div className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
