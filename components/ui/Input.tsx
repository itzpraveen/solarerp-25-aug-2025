'use client';
import clsx from 'clsx';
import { forwardRef } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/30',
        className,
      )}
      {...props}
    />
  );
});

export default Input;
