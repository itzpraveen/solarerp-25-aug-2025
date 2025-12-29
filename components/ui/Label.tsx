'use client';
import clsx from 'clsx';

export default function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={clsx(
        'block text-sm font-medium text-[var(--text-secondary)]',
        className,
      )}
    >
      {children}
    </label>
  );
}
