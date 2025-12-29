'use client';
import Link from 'next/link';

export default function Breadcrumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">/</span>}
          {it.href ? (
            <Link className="text-[var(--primary-600)]" href={it.href}>
              {it.label}
            </Link>
          ) : (
            <span>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
