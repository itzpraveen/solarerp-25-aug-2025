'use client';
import { useEffect, useRef, useState } from 'react';
import Input from '~/components/ui/Input';
import { supabaseBrowser } from '@/lib/supabaseClient';

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

export default function CustomerTypeahead({
  selected,
  onSelect,
  onCreateRequested,
  placeholder = 'Search customer by name or phone…',
}: {
  selected: { id: string; name: string } | null;
  onSelect: (c: Customer) => void;
  onCreateRequested: (term: string) => void;
  placeholder?: string;
}) {
  const supabase = supabaseBrowser();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Customer[]>([]);
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTerm(selected?.name || '');
  }, [selected?.id]);

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const q = term.trim();
      if (!q || q.length < 2) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, name, phone, address, deleted_at')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .limit(8);
        if (active) setRows(((data as any[]) || []) as Customer[]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term, supabase]);

  const showCreate = term.trim().length >= 2 && !loading && rows.length === 0;

  return (
    <div className="relative" ref={boxRef}>
      <Input
        value={term}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((v) => Math.min(v + 1, Math.max(0, rows.length - 1)));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((v) => Math.max(v - 1, 0));
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (rows[sel]) {
              onSelect(rows[sel]);
              setOpen(false);
            } else if (showCreate) {
              onCreateRequested(term.trim());
            }
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded border bg-white text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading && (
            <div className="px-3 py-2 text-gray-600 dark:text-gray-300">
              Searching…
            </div>
          )}
          {!loading &&
            rows.map((r, i) => (
              <button
                type="button"
                key={r.id}
                className={`flex w-full items-center justify-between px-3 py-2 text-left ${i === sel ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                }}
              >
                <span className="truncate">{r.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {r.phone || ''}
                </span>
              </button>
            ))}
          {!loading && showCreate && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-blue-600"
              onClick={() => onCreateRequested(term.trim())}
            >
              Create “{term.trim()}” as new customer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
