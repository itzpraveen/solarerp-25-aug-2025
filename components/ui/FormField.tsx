'use client';
import clsx from 'clsx';
import Label from './Label';

type Props = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
};

export default function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: Props) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      <div className="min-h-[1.25rem]">
        {error ? (
          <div className="text-xs text-[var(--danger-600)] font-medium" role="alert">
            {error}
          </div>
        ) : hint ? (
          <div className="text-xs text-[var(--text-muted)]">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}
