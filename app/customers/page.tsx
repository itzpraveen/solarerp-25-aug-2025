'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Button from '~/components/ui/Button';
import RequireOwner from '~/components/RequireOwner';
import Input from '~/components/ui/Input';
import { isEmail, isPhone, required } from '@/lib/validation';
import { ensureProfileIfMissing } from '@/lib/ensureProfileClient';
import Card from '~/components/ui/Card';
import EmptyState from '~/components/ui/EmptyState';
import DataTable, { type Column } from '~/components/ui/DataTable';
import { useToast } from '~/components/ui/ToastProvider';

export default function CustomersPage() {
  const supabase = supabaseBrowser();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Pagination & sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || 0) / pageSize)),
    [totalCount, pageSize],
  );
  const [sortBy, setSortBy] = useState<'created' | 'name-asc' | 'name-desc'>(
    'created',
  );
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast } = useToast();
  const [showDeleted, setShowDeleted] = useState(false);

  const getTenantId = async (): Promise<string | null> => {
    return await ensureProfileIfMissing(supabase);
  };

  const load = async () => {
    setLoadingList(true);
    // Build base query; RLS already restricts to tenant and omits deleted rows
    let q = supabase
      .from('customers')
      .select('id,name,phone,email,address,deleted_at,created_at', {
        count: 'exact',
      });
    // Search server-side across common fields
    const term = (debouncedSearch || '').trim();
    if (term) {
      const esc = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
      q = q.or(
        `name.ilike.%${esc}%,phone.ilike.%${esc}%,email.ilike.%${esc}%`,
      );
    }
    // Sorting
    if (sortBy === 'created') q = q.order('created_at', { ascending: false });
    else if (sortBy === 'name-asc') q = q.order('name', { ascending: true });
    else if (sortBy === 'name-desc') q = q.order('name', { ascending: false });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) {
      console.error('Failed to load customers', error);
      setCustomers([]);
      setTotalCount(0);
      setLoadingList(false);
      return;
    }
    const list = (data as any[]) || [];
    // When showDeleted is toggled on, we still won't receive deleted rows due to RLS.
    // Keep the UI element for parity, but data respects server policy.
    setCustomers(list);
    setTotalCount(count || 0);
    setLoadingList(false);
  };
  // Debounce search input to avoid chatty queries
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  // Auth-gated initial and reactive loads
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, page, pageSize, showDeleted]);
  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy]);

  const add = async () => {
    setErr(null);
    if (!required(name)) return setErr('Name is required');
    if (email && !isEmail(email)) return setErr('Invalid email');
    if (phone && !isPhone(phone)) return setErr('Invalid phone');
    setAdding(true);
    const tenantId = await getTenantId();
    if (!tenantId) {
      setAdding(false);
      setErr('Profile not ready');
      toast({ title: 'Profile not ready', variant: 'error' });
      return;
    }
    // duplicate phone check within tenant
    if (phone) {
      const { data: dup } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', phone)
        .maybeSingle();
      if (dup) {
        setAdding(false);
        return setErr('Phone already exists for this tenant');
      }
    }
    const { error } = await supabase.from('customers').insert({
      tenant_id: tenantId,
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    });
    setAdding(false);
    if (error) {
      setErr(error.message);
      toast({
        title: 'Add failed',
        description: error.message,
        variant: 'error',
      });
      return;
    }
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    toast({ title: 'Customer added', variant: 'success' });
    load();
  };

  const csvCustomers =
    'Name,Phone,Email,Address\n' +
    customers
      .map((c) =>
        [c.name || '', c.phone || '', c.email || '', c.address || ''].join(','),
      )
      .join('\n');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Customers</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Show deleted
          </label>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded border px-2 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            title="Sort order"
          >
            <option value="created">Recently added</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </div>
      </div>
      {err && (
        <div className="rounded border bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={add} loading={adding}>
              Add
            </Button>
            <a
              className="rounded border px-3 py-2 text-sm"
              href={
                'data:text/csv;charset=utf-8,' +
                encodeURIComponent(csvCustomers)
              }
              download="customers.csv"
            >
              Export CSV
            </a>
          </div>
        </div>
      </Card>
      {loadingList ? (
        <Card>
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        </Card>
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer to start creating jobs and proposals."
          action={
            <Button onClick={add} disabled={!name}>
              Quick add
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded border bg-white overflow-x-auto">
            <div className="flex items-center justify-between p-2 text-xs text-gray-600 sticky top-0 bg-white z-10 border-b">
              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <select
                  className="rounded border px-2 py-1"
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-600">
                Page {page} of {totalPages} • {totalCount} customers
              </div>
            </div>
            <DataTable
              rows={customers}
              columns={
            [
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'email', header: 'Email' },
              { key: 'address', header: 'Address' },
              {
                key: 'actions',
                header: 'Actions',
                render: (c: any) => (
                  <div className="flex items-center gap-2">
                    <a href={`/customers/${c.id}`} className="text-[var(--primary-600)]">
                      Open
                    </a>
                    <RequireOwner>
                      {c.deleted_at ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await supabase
                              .from('customers')
                              .update({ deleted_at: null })
                              .eq('id', c.id);
                            load();
                            toast({
                              title: 'Customer restored',
                              variant: 'success',
                            });
                          }}
                        >
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={async () => {
                            const ok = confirm(
                              'Soft-delete this customer? Their jobs and documents will remain.',
                            );
                            if (!ok) return;
                            await supabase
                              .from('customers')
                              .update({ deleted_at: new Date().toISOString() })
                              .eq('id', c.id);
                            load();
                            toast({
                              title: 'Customer deleted',
                              variant: 'success',
                            });
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </RequireOwner>
                  </div>
                ),
              },
            ] as Column<any>[]
          }
            />
          </div>
          {/* Bottom pager */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
            <div>
              Page {page} of {totalPages} • {totalCount} customers
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                aria-label="First page"
                title="First"
              >
                « First
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                title="Previous"
              >
                ‹ Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                title="Next"
              >
                Next ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="Last page"
                title="Last"
              >
                Last »
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
