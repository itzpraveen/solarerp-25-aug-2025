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
  const base =
    'inline-flex rounded-md border bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900';
  const btn = 'px-2 py-1 text-sm rounded';
  const btnMd = 'px-3 py-1.5 text-sm';
  return (
    <div
      className={clsx(base, className)}
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
              active
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
              size === 'md' ? btnMd : btn,
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
