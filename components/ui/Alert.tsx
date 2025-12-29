'use client';
import clsx from 'clsx';

type Variant = 'info' | 'success' | 'error' | 'warning';

export default function Alert({
  children,
  variant = 'info',
  className,
  role = 'status',
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  role?: 'status' | 'alert';
}) {
  const styles: Record<Variant, string> = {
    info: [
      'bg-[var(--info-50)] text-[var(--info-700)] border-[var(--info-100)]',
      'dark:bg-[var(--info-50)]/20 dark:text-[var(--info-600)] dark:border-[var(--info-100)]/30',
    ].join(' '),
    success: [
      'bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]',
      'dark:bg-[var(--success-50)]/20 dark:text-[var(--success-600)] dark:border-[var(--success-100)]/30',
    ].join(' '),
    error: [
      'bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]',
      'dark:bg-[var(--danger-50)]/20 dark:text-[var(--danger-600)] dark:border-[var(--danger-100)]/30',
    ].join(' '),
    warning: [
      'bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]',
      'dark:bg-[var(--warning-50)]/20 dark:text-[var(--warning-600)] dark:border-[var(--warning-100)]/30',
    ].join(' '),
  };
  return (
    <div
      role={role}
      className={clsx(
        'rounded-lg border px-4 py-3 text-sm',
        'flex items-start gap-3',
        styles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
