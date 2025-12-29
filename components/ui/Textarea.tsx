'use client';
import clsx from 'clsx';
import { forwardRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]',
        'px-3 py-2 text-sm text-[var(--text-primary)]',
        'placeholder:text-[var(--text-muted)]',
        'shadow-sm transition-all duration-150',
        'hover:border-[var(--border-strong)]',
        'focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]/20',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-muted)]',
        'resize-y min-h-[80px]',
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
