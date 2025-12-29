'use client';
import clsx from 'clsx';

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1',
        className,
      )}
      role="tablist"
      aria-label="segmented-control"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            className={clsx(
              'rounded-md font-medium transition-all duration-150',
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-sm',
            )}
            onClick={() => onChange(o.value)}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
