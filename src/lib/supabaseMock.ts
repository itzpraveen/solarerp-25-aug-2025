/* Minimal in-memory Supabase mock for E2E/DEV.
   Covers a subset of methods used in the app. */

type Row = Record<string, any>;

type TableName =
  | 'tenants'
  | 'profiles'
  | 'settings'
  | 'items'
  | 'kits'
  | 'kit_items'
  | 'customers'
  | 'jobs'
  | 'leads'
  | 'proposals'
  | 'tasks'
  | 'documents'
  | 'invoices'
  | 'payments'
  | 'service_tickets';

export type MockDb = {
  currentUserId: string | null;
  users: { id: string; email: string }[];
  tenants: Row[];
  profiles: Row[];
  settings: Row[];
  items: Row[];
  kits: Row[];
  kit_items: Row[];
  customers: Row[];
  jobs: Row[];
  leads: Row[];
  proposals: Row[];
  tasks: Row[];
  documents: Row[];
  invoices: Row[];
  payments: Row[];
  service_tickets: Row[];
};

function seedDb(): MockDb {
  const tenantId = 't1';
  const users = [
    { id: 'u-owner', email: 'owner@demo.local' },
    { id: 'u-staff', email: 'staff@demo.local' },
    { id: 'u-admin', email: 'admin@demo.local' },
    { id: 'u-tech', email: 'tech@demo.local' },
  ];
  const customers = [
    {
      id: 'c1',
      tenant_id: tenantId,
      name: 'Alice',
      phone: '',
      email: '',
      address: '',
    },
  ];
  const jobs = [
    {
      id: 'j1',
      tenant_id: tenantId,
      customer_id: 'c1',
      status: 'Lead',
      capacity_kw: '3',
      system_type: 'On-grid',
      location: 'Kochi',
    },
  ];
  const items = [
    {
      item_code: 'PV-3KW',
      tenant_id: tenantId,
      name: '3kW PV Module Set',
      category: 'PV',
      unit: 'set',
      gst_rate: 12,
      mrp: 150000,
      preferred_vendor: 'SolarVendor',
    },
    {
      item_code: 'INV-3KW',
      tenant_id: tenantId,
      name: '3kW Inverter',
      category: 'Inverter',
      unit: 'nos',
      gst_rate: 18,
      mrp: 45000,
      preferred_vendor: 'VoltCo',
    },
  ];
  const kits = [
    {
      kit_name: 'On-grid 3kW',
      tenant_id: tenantId,
      capacity_kw: 3,
      selling_price: 185000,
      description: 'Standard on-grid 3kW system',
    },
  ];
  const kit_items = [
    { kit_name: 'On-grid 3kW', item_code: 'PV-3KW', qty: 1 },
    { kit_name: 'On-grid 3kW', item_code: 'INV-3KW', qty: 1 },
  ];
  return {
    // Do not auto-sign in a demo user by default; require explicit quick sign-in.
    currentUserId: null,
    users,
    tenants: [{ id: tenantId, name: 'Demo Co' }],
    profiles: [
      {
        user_id: users[0].id,
        tenant_id: tenantId,
        role: 'owner',
        display_name: 'Owner User',
      },
      {
        user_id: users[1].id,
        tenant_id: tenantId,
        role: 'staff',
        display_name: 'Staff User',
      },
      {
        user_id: users[2].id,
        tenant_id: tenantId,
        role: 'admin',
        display_name: 'Admin User',
      },
      {
        user_id: users[3].id,
        tenant_id: tenantId,
        role: 'technician',
        display_name: 'Tech User',
      },
    ],
    settings: [
      {
        id: 's1',
        tenant_id: tenantId,
        currency: 'INR',
        default_tax_rate: 18,
        deposit_percent: 30,
      },
    ],
    items,
    kits,
    kit_items,
    customers,
    jobs,
    leads: [],
    proposals: [],
    tasks: [],
    documents: [],
    invoices: [],
    payments: [],
    service_tickets: [],
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
  private _limit: number | null = null;
  constructor(table: TableName) {
    this.table = table;
  }

  select(sel: string) {
    this._select = sel;
    return this;
  }
  eq(k: string, v: any) {
    this.filters.push([k, v]);
    return this;
  }
  in(k: string, vs: any[]) {
    /* simple contains */ this.filters.push([`__in__${k}`, vs]);
    return this;
  }
  order(key: string, { ascending = true } = {}) {
    this._order = { key, ascending };
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }

  private applyFilters(rows: Row[]) {
    return rows
      .filter((r) =>
        matchEq(
          r,
          this.filters.filter(([k]) => !k.startsWith('__in__')) as any[],
        ),
      )
      .filter((r) =>
        this.filters.every(([k, v]) =>
          k.startsWith('__in__')
            ? (v as any[]).includes(r[k.replace('__in__', '')])
            : true,
        ),
      );
  }

  async single() {
    const { data } = await this._exec();
    return { data: (data as any[])[0] ?? null, error: null };
  }
  async maybeSingle() {
    return this.single();
  }

  async _exec() {
    const db = getDb();
    let rows = (db[this.table] as Row[]) || [];
    // special case: profiles.single() with no filter => current user
    if (this.table === 'profiles' && this.filters.length === 0) {
      const me =
        db.profiles.find((p) => p.user_id === db.currentUserId) || null;
      // Return as array so .single/.maybeSingle work consistently
      return { data: me ? [me] : [], error: null } as any;
    }
    rows = this.applyFilters(rows);
    if (this._order) {
      const cleanKey = this._order.key.replace(/\"/g, '').replace(/"/g, '');
      rows = orderBy(rows, cleanKey, this._order.ascending);
    }
    // Relations used in UI
    if (this.table === 'jobs') {
      if (this._select?.includes('customers(')) {
        rows = rows.map((r) => {
          const c = db.customers.find((cu) => cu.id === r.customer_id) || {};
          return {
            ...r,
            customers: [
              {
                name: c.name || '—',
                phone: c.phone || '',
                email: c.email || '',
              },
            ],
          };
        });
      }
      if (this._select?.includes('tenants(')) {
        rows = rows.map((r) => {
          const t = db.tenants.find((tn) => tn.id === r.tenant_id) || {};
          return { ...r, tenants: { name: t.name || 'Tenant' } };
        });
      }
    }
    if (this.table === 'proposals' && this._select?.includes('jobs(')) {
      rows = rows.map((r) => {
        const j = db.jobs.find((jb) => jb.id === r.job_id) || {};
        const c =
          db.customers.find((cu) => cu.id === (j as any).customer_id) || {};
        return {
          ...r,
          jobs: {
            id: (j as any).id,
            customers: [{ name: c.name || '—', phone: c.phone || '' }],
          },
        };
      });
    }
    if (this.table === 'service_tickets') {
      if (this._select?.includes('customers(')) {
        rows = rows.map((r) => {
          const c = db.customers.find((cu) => cu.id === r.customer_id) || {};
          return { ...r, customers: [{ name: (c as any).name || '—' }] };
        });
      }
      if (this._select?.includes('jobs(')) {
        rows = rows.map((r) => {
          const j = db.jobs.find((jb) => jb.id === r.job_id) || {};
          return { ...r, jobs: { id: (j as any).id } };
        });
      }
    }
    if (this.table === 'kit_items' && this._select?.includes('items(')) {
      rows = rows.map((r) => {
        const it = db.items.find((i) => i.item_code === r.item_code) || {};
        return {
          ...r,
          items: {
            name: it.name || '',
            unit: it.unit || '',
            preferred_vendor: it.preferred_vendor || '',
            mrp: it.mrp || 0,
          },
        };
      });
    }
    if (this.table === 'payments' && this._select?.includes('invoices(')) {
      rows = rows.map((r) => {
        const inv = db.invoices.find((i) => i.id === r.invoice_id) || {};
        return { ...r, invoices: { total: (inv as any).total || 0 } };
      });
    }
    if (this._limit != null) rows = rows.slice(0, this._limit);
    return { data: rows, error: null };
  }

  async then(resolve: (v: any) => void, reject?: (e: any) => void) {
    try {
      resolve(await this._exec());
    } catch (e) {
      reject?.(e);
    }
  }

  insert(payload: Row | Row[]) {
    const db = getDb();
    const items = Array.isArray(payload) ? payload : [payload];
    // auto id
    const withIds = items.map((it) => {
      if (it.id == null) {
        // generate a simple id
        const prefix =
          String(this.table)
            .split('_')
            .map((s) => s[0])
            .join('') || 'id';
        return {
          id: `${prefix}_${Math.random().toString(36).slice(2, 8)}`,
          ...it,
        };
      }
      return it;
    });
    (db[this.table] as Row[]).push(...withIds);
    return {
      select: (_?: string) => ({
        single: async () => ({ data: withIds[0], error: null }),
      }),
    } as any;
  }

  upsert(payload: Row | Row[]) {
    return this.insert(payload);
  }

  update(patch: Row) {
    const db = getDb();
    const rows = this.applyFilters((db[this.table] as Row[]) || []);
    rows.forEach((r) => Object.assign(r, patch));
    return {
      eq: (k: string, v: any) => {
        this.eq(k, v);
        return { then: (res: any) => res({ data: rows, error: null }) } as any;
      },
    } as any;
  }

  async delete() {
    const self = this;
    return {
      eq(k: string, v: any) {
        self.eq(k, v);
        return this;
      },
      then(resolve: (v: any) => void, reject?: (e: any) => void) {
        try {
          const db = getDb();
          const all = (db[self.table] as Row[]) || [];
          const keep = all.filter((r) => !self.applyFilters([r]).length);
          (db[self.table] as any).length = 0;
          (db[self.table] as any).push(...keep);
          resolve({ data: null, error: null });
        } catch (e) {
          reject?.(e);
        }
      },
    } as any;
  }
}

export function getMockClient() {
  const db = getDb();

  return {
    auth: {
      async getSession() {
        if (!db.currentUserId) return { data: { session: null }, error: null };
        const user = db.users.find((u) => u.id === db.currentUserId)!;
        return { data: { session: { user } }, error: null } as any;
      },
      async getUser() {
        if (!db.currentUserId) return { data: { user: null }, error: null };
        const user = db.users.find((u) => u.id === db.currentUserId)!;
        return { data: { user }, error: null } as any;
      },
      onAuthStateChange(cb: any) {
        // Immediately notify as signed-in if we have a user
        const sub = { subscription: { unsubscribe() {} } } as any;
        this.getSession().then(({ data }) => {
          if (data.session) cb('SIGNED_IN', data.session);
        });
        return { data: sub };
      },
      async signInWithOtp({
        email,
        phone,
      }: {
        email?: string;
        phone?: string;
      }) {
        if (email) {
          const found = db.users.find((u) => u.email === email);
          db.currentUserId = (found || db.users[0]).id;
        } else if (phone) {
          db.currentUserId = db.users[1].id;
        }
        return { data: {}, error: null } as any;
      },
      async signOut() {
        db.currentUserId = null;
        return { error: null } as any;
      },
    },
    from(table: TableName) {
      return new MockQuery(table);
    },
    storage: {
      from(_bucket: string) {
        return {
          async createSignedUrl(key: string, _exp: number) {
            return {
              data: { signedUrl: `https://example.com/${key}` },
              error: null,
            };
          },
          async upload(_key: string, _file: any) {
            return { data: {}, error: null };
          },
        };
      },
    },
  };
}

export function getDbRef() {
  return getDb();
}

export function resetDb() {
  const g: any = typeof window === 'undefined' ? globalThis : window;
  g.__MOCK_DB__ = seedDb();
}
