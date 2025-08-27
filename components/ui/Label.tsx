'use client';
import clsx from 'clsx';

export default function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={clsx(
        'block text-sm font-medium text-gray-700 dark:text-gray-300',
        className,
      )}
    >
      {children}
    </label>
  );
}
