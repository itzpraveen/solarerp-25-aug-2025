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
    default:
      'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200',
    success:
      'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-200',
    warning:
      'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-200',
    danger: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-200',
    info: 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-200',
    muted:
      'border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
