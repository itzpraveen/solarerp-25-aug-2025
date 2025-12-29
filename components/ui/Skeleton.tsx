'use client';
import clsx from 'clsx';

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-lg bg-[var(--bg-muted)]',
        className,
      )}
    />
  );
}
