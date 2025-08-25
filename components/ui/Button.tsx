"use client";
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { forwardRef } from 'react';
import Spinner from './Spinner';

const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-900 text-white hover:bg-black focus:ring-gray-700',
        outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-300',
        ghost: 'bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      },
      size: {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-2',
        lg: 'text-base px-4 py-2.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { className?: string; loading?: boolean };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, loading, children, disabled, ...props }, ref) {
  return (
    <button ref={ref} className={clsx(button({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
});

export default Button;
