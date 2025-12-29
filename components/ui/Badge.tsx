import clsx from 'clsx';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export default function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const styles: Record<Variant, string> = {
    default: [
      'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]',
    ].join(' '),
    success: [
      'bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-100)]',
      'dark:bg-[var(--success-50)]/30 dark:text-[var(--success-600)] dark:border-[var(--success-100)]/50',
    ].join(' '),
    warning: [
      'bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-100)]',
      'dark:bg-[var(--warning-50)]/30 dark:text-[var(--warning-600)] dark:border-[var(--warning-100)]/50',
    ].join(' '),
    danger: [
      'bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-100)]',
      'dark:bg-[var(--danger-50)]/30 dark:text-[var(--danger-600)] dark:border-[var(--danger-100)]/50',
    ].join(' '),
    info: [
      'bg-[var(--info-50)] text-[var(--info-700)] border-[var(--info-100)]',
      'dark:bg-[var(--info-50)]/30 dark:text-[var(--info-600)] dark:border-[var(--info-100)]/50',
    ].join(' '),
    muted: [
      'bg-transparent text-[var(--text-muted)] border-[var(--border-default)]',
    ].join(' '),
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'transition-colors duration-150',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
