"use client";
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

export default function FormField({ id, label, hint, error, className, children }: Props) {
  return (
    <div className={clsx('space-y-1', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      <div className="min-h-[1rem]">
        {error ? (
          <div className="text-xs text-red-600" role="alert">{error}</div>
        ) : hint ? (
          <div className="text-xs text-gray-500">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

