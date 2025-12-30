'use client';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { forwardRef } from 'react';
import Spinner from './Spinner';

const button = cva(
  [
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition-all duration-150 ease-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.98]',
    'focus-visible:ring-offset-[var(--bg-surface)]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--primary-600)] text-white',
          'hover:bg-[var(--primary-700)] hover:shadow-[var(--shadow-md)]',
          'focus-visible:ring-[var(--primary-500)]',
          'dark:bg-[var(--primary-500)] dark:hover:bg-[var(--primary-600)]',
          'dark:focus-visible:ring-[var(--primary-600)]',
        ].join(' '),
        secondary: [
          'bg-slate-800 text-white',
          'hover:bg-slate-900 hover:shadow-[var(--shadow-md)]',
          'focus-visible:ring-slate-600',
          'dark:bg-slate-700 dark:hover:bg-slate-600',
          'dark:focus-visible:ring-slate-500',
        ].join(' '),
        outline: [
          'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]',
          'hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]',
          'focus-visible:ring-[var(--border-focus)]',
        ].join(' '),
        ghost: [
          'bg-transparent text-[var(--text-primary)]',
          'hover:bg-[var(--bg-subtle)]',
          'focus-visible:ring-[var(--border-focus)]',
        ].join(' '),
        danger: [
          'bg-[var(--danger-600)] text-white',
          'hover:bg-[var(--danger-700)] hover:shadow-[var(--shadow-md)]',
          'focus-visible:ring-[var(--danger-500)]',
        ].join(' '),
        success: [
          'bg-[var(--success-600)] text-white',
          'hover:bg-[var(--success-700)] hover:shadow-[var(--shadow-md)]',
          'focus-visible:ring-[var(--success-500)]',
        ].join(' '),
      },
      size: {
        xs: 'text-[11px] px-2 py-1 gap-1',
        sm: 'text-xs px-2.5 py-1.5 gap-1.5',
        md: 'text-sm px-3.5 py-2 gap-2',
        lg: 'text-base px-5 py-2.5 gap-2',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { className?: string; loading?: boolean };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export default Button;
