/* Minimal in-memory Supabase mock for E2E/DEV.
   Covers a subset of methods used in the app. */

type Row = Record<string, any>;

type TableName =
  | 'tenants'
  | 'profiles'
  | 'settings'
  | 'customers'
  | 'jobs'
  | 'leads'
  | 'proposals'
  | 'tasks'
  | 'documents'
  | 'invoices'
  | 'payments';

export type MockDb = {
  currentUserId: string | null;
  users: { id: string; email: string }[];
  tenants: Row[];
  profiles: Row[];
  settings: Row[];
  customers: Row[];
  jobs: Row[];
  leads: Row[];
  proposals: Row[];
  tasks: Row[];
  documents: Row[];
  invoices: Row[];
  payments: Row[];
};

function seedDb(): MockDb {
  const tenantId = 't1';
  const users = [
    { id: 'u-admin', email: 'owner@demo.local' },
    { id: 'u-staff', email: 'staff@demo.local' },
  ];
  const customers = [{ id: 'c1', tenant_id: tenantId, name: 'Alice' }];
  const jobs = [
    { id: 'j1', tenant_id: tenantId, customer_id: 'c1', status: 'Lead', capacity_kw: '3', system_type: 'On-grid', location: 'Kochi' },
  ];
  return {
    currentUserId: users[0].id,
    users,
    tenants: [{ id: tenantId, name: 'Demo Co' }],
    profiles: [
      { user_id: users[0].id, tenant_id: tenantId, role: 'owner', display_name: 'Admin User' },
      { user_id: users[1].id, tenant_id: tenantId, role: 'staff', display_name: 'Staff User' },
    ],
    settings: [{ tenant_id: tenantId, currency: 'INR', default_tax_rate: 18 }],
    customers,
    jobs,
    leads: [],
    proposals: [],
    tasks: [],
    documents: [],
    invoices: [],
    payments: [],
  };
}

function getDb(): MockDb {
  const g: any = typeof window === 'undefined' ? globalThis : window;
  if (!g.__MOCK_DB__) g.__MOCK_DB__ = seedDb();
  return g.__MOCK_DB__ as MockDb;
}

function matchEq(row: Row, filters: [string, any][]) {
  return filters.every(([k, v]) => row[k] === v);
}

function orderBy(rows: Row[], key: string, ascending = true) {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
  });
}

class MockQuery {
  private table: TableName;
  private filters: [string, any][] = [];
  private _order: { key: string; ascending: boolean } | null = null;
  private _select: string | null = null;
  constructor(table: TableName) { this.table = table; }

  select(sel: string) { this._select = sel; return this; }
  eq(k: string, v: any) { this.filters.push([k, v]); return this; }
  in(k: string, vs: any[]) { /* simple contains */ this.filters.push([`__in__${k}`, vs]); return this; }
  order(key: string, { ascending = true } = {}) { this._order = { key, ascending }; return this; }

  private applyFilters(rows: Row[]) {
    return rows.filter(r => matchEq(r, this.filters.filter(([k]) => !k.startsWith('__in__')) as any[]))
      .filter(r => this.filters.every(([k, v]) => k.startsWith('__in__') ? (v as any[]).includes(r[k.replace('__in__', '')]) : true));
  }

  async single() {
    const { data } = await this._exec();
    return { data: (data as any[])[0] ?? null, error: null };
  }
  async maybeSingle() { return this.single(); }

  async _exec() {
    const db = getDb();
    let rows = (db[this.table] as Row[]) || [];
    // special case: profiles.single() with no filter => current user
    if (this.table === 'profiles' && this.filters.length === 0) {
      const me = db.profiles.find(p => p.user_id === db.currentUserId) || null;
      return { data: me, error: null } as any;
    }
    rows = this.applyFilters(rows);
    if (this._order) rows = orderBy(rows, this._order.key, this._order.ascending);
    // Include simple relations used in UI: jobs.customers(name)
    if (this.table === 'jobs' && this._select?.includes('customers(')) {
      rows = rows.map(r => ({ ...r, customers: [{ name: (db.customers.find(c => c.id === r.customer_id) || { name: '—' }).name }] }));
    }
    return { data: rows, error: null };
  }

  async then(resolve: (v: any) => void, reject?: (e: any) => void) {
    try { resolve(await this._exec()); } catch (e) { reject?.(e); }
  }

  async insert(payload: Row | Row[]) {
    const db = getDb();
    const items = Array.isArray(payload) ? payload : [payload];
    (db[this.table] as Row[]).push(...items);
    return { select: () => ({ single: async () => ({ data: items[0], error: null }) }) } as any;
  }

  async upsert(payload: Row | Row[]) { return this.insert(payload); }

  update(patch: Row) {
    const db = getDb();
    const rows = this.applyFilters((db[this.table] as Row[]) || []);
    rows.forEach(r => Object.assign(r, patch));
    return { eq: (k: string, v: any) => this.eq(k, v) && ({ then: (res: any) => res({ data: rows, error: null }) }) } as any;
  }

  async delete() {
    const db = getDb();
    const all = (db[this.table] as Row[]);
    const keep = all.filter(r => !this.applyFilters([r]).length);
    (db[this.table] as any).length = 0; (db[this.table] as any).push(...keep);
    return { data: null, error: null } as any;
  }
}

export function getMockClient() {
  const db = getDb();

  return {
    auth: {
      async getSession() {
        if (!db.currentUserId) return { data: { session: null }, error: null };
        const user = db.users.find(u => u.id === db.currentUserId)!;
        return { data: { session: { user } }, error: null } as any;
      },
      async getUser() {
        if (!db.currentUserId) return { data: { user: null }, error: null };
        const user = db.users.find(u => u.id === db.currentUserId)!;
        return { data: { user }, error: null } as any;
      },
      onAuthStateChange(cb: any) {
        // Immediately notify as signed-in if we have a user
        const sub = { subscription: { unsubscribe() {} } } as any;
        this.getSession().then(({ data }) => { if (data.session) cb('SIGNED_IN', data.session); });
        return { data: sub };
      },
      async signInWithOtp({ email, phone }: { email?: string; phone?: string }) {
        if (email) {
          const found = db.users.find(u => u.email === email);
          db.currentUserId = (found || db.users[0]).id;
        } else if (phone) {
          db.currentUserId = db.users[1].id;
        }
        return { data: {}, error: null } as any;
      },
      async signOut() { db.currentUserId = null; return { error: null } as any; },
    },
    from(table: TableName) { return new MockQuery(table); },
    storage: {
      from(_bucket: string) {
        return {
          async createSignedUrl(key: string, _exp: number) {
            return { data: { signedUrl: `https://example.com/${key}` }, error: null };
          },
          async upload(_key: string, _file: any) { return { data: {}, error: null }; },
        };
      },
    },
  };
}

export function getDbRef() { return getDb(); }

