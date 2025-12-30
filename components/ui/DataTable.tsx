'use client';
import React, { useMemo, useState } from 'react';
import Input from '~/components/ui/Input';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  className?: string;
};

export default function DataTable<T extends { id?: string | number }>({
  rows,
  columns,
  searchPlaceholder,
  onSearch,
  stickyHeader = true,
}: {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  stickyHeader?: boolean;
}) {
  const [term, setTerm] = useState('');
  const filtered = useMemo(() => {
    if (!term) return rows;
    const lc = term.toLowerCase();
    try {
      return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(lc));
    } catch {
      return rows;
    }
  }, [rows, term]);

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-sm)]">
      {(onSearch || searchPlaceholder) && (
        <div className="flex items-center justify-between gap-2 p-3 border-b border-[var(--border-subtle)]">
          <Input
            className="!py-1.5"
            placeholder={searchPlaceholder || 'Search...'}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              onSearch?.(e.target.value);
            }}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className={
                (stickyHeader ? 'sticky top-0 z-10 ' : '') +
                'border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left'
              }
            >
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={'px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wide ' + (c.className || '')}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((r, i) => (
              <tr
                key={(r.id as any) ?? i}
                className="hover:bg-[var(--bg-subtle)]/50 transition-colors"
              >
                {columns.map((c) => (
                  <td key={c.key} className={'px-4 py-3 text-[var(--text-primary)] ' + (c.className || '')}>
                    {c.render
                      ? c.render(r)
                      : c.accessor
                        ? c.accessor(r)
                        : (r as any)[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  No rows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
