'use client';
import clsx from 'clsx';
import { forwardRef } from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
};

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={clsx(
        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/30',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
