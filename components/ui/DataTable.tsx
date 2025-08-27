'use client';
import React, { useMemo, useState } from 'react';

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
    <div className="rounded border bg-white overflow-x-auto dark:border-gray-800 dark:bg-gray-900">
      {(onSearch || searchPlaceholder) && (
        <div className="flex items-center justify-between gap-2 p-2">
          <input
            className="w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
            placeholder={searchPlaceholder || 'Search'}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              onSearch?.(e.target.value);
            }}
          />
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr
            className={
              (stickyHeader ? 'sticky top-0 ' : '') +
              'border-b bg-gray-50 text-left dark:border-gray-800 dark:bg-gray-800'
            }
          >
            {columns.map((c) => (
              <th key={c.key} className={'p-2 ' + (c.className || '')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr
              key={(r.id as any) ?? i}
              className="border-b dark:border-gray-800"
            >
              {columns.map((c) => (
                <td key={c.key} className={'p-2 ' + (c.className || '')}>
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
                className="p-3 text-center text-gray-600 dark:text-gray-400"
              >
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
