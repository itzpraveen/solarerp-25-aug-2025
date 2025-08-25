"use client";
import clsx from 'clsx';
import { forwardRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string };

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30',
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;

