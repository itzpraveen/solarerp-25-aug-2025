'use client';
import React, { useMemo, useState, useCallback, memo } from 'react';
import Input from '~/components/ui/Input';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  className?: string;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Memoized table row component
const TableRow = memo(function TableRow<T>({
  row,
  columns,
  rowKey,
}: {
  row: T;
  columns: Column<T>[];
  rowKey: string | number;
}) {
  return (
    <tr className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
      {columns.map((c) => (
        <td
          key={c.key}
          className={'px-4 py-3 text-[var(--text-primary)] ' + (c.className || '')}
        >
          {c.render
            ? c.render(row)
            : c.accessor
              ? c.accessor(row)
              : (row as any)[c.key]}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: { row: T; columns: Column<T>[]; rowKey: string | number }) => React.ReactElement;

export default function DataTable<T extends { id?: string | number }>({
  rows,
  columns,
  searchPlaceholder,
  onSearch,
  stickyHeader = true,
  paginate = true,
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  stickyHeader?: boolean;
  paginate?: boolean;
  defaultPageSize?: number;
}) {
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (!term) return rows;
    const lc = term.toLowerCase();
    try {
      return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(lc));
    } catch {
      return rows;
    }
  }, [rows, term]);

  // Paginated data
  const paginatedData = useMemo(() => {
    if (!paginate) return filtered;
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, paginate]);

  const totalPages = useMemo(() => {
    return Math.ceil(filtered.length / pageSize);
  }, [filtered.length, pageSize]);

  // Reset to first page when search changes
  const handleSearch = useCallback((value: string) => {
    setTerm(value);
    setPage(0);
    onSearch?.(value);
  }, [onSearch]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(0);
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-sm)]">
      {(onSearch || searchPlaceholder) && (
        <div className="flex items-center justify-between gap-2 p-3 border-b border-[var(--border-subtle)]">
          <Input
            className="!py-1.5"
            placeholder={searchPlaceholder || 'Search...'}
            value={term}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {paginate && filtered.length > 0 && (
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
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
            {paginatedData.map((r, i) => (
              <TableRow
                key={(r.id as any) ?? `row-${page * pageSize + i}`}
                row={r}
                columns={columns}
                rowKey={(r.id as any) ?? i}
              />
            ))}
            {paginatedData.length === 0 && (
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
      {/* Pagination controls */}
      {paginate && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Rows per page:</span>
            <select
              className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                ««
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                »
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
