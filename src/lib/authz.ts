export type Role = 'owner' | 'admin' | 'manager' | 'sales' | 'technician' | 'accountant' | 'viewer' | 'staff';

// Define app-level permissions and which roles have them.
// Keep simple and explicit; can evolve to DB-driven later.
export type Permission =
  | 'settings.manage'
  | 'team.manage'
  | 'items.manage'
  | 'kits.manage'
  | 'leads.view'
  | 'leads.edit'
  | 'jobs.view'
  | 'jobs.edit'
  | 'invoices.view'
  | 'invoices.edit'
  | 'service.view'
  | 'service.edit'
  | 'service.self_edit';

const byRole: Record<Role, Permission[]> = {
  owner: [
    'settings.manage', 'team.manage', 'items.manage', 'kits.manage',
    'leads.view', 'leads.edit', 'jobs.view', 'jobs.edit',
    'invoices.view', 'invoices.edit', 'service.view', 'service.edit',
  ],
  admin: [
    'settings.manage', 'team.manage', 'items.manage', 'kits.manage',
    'leads.view', 'leads.edit', 'jobs.view', 'jobs.edit',
    'invoices.view', 'invoices.edit', 'service.view', 'service.edit',
  ],
  manager: [
    'leads.view', 'leads.edit', 'jobs.view', 'jobs.edit',
    'invoices.view', 'service.view', 'service.edit',
  ],
  sales: ['leads.view', 'leads.edit', 'jobs.view', 'invoices.view'],
  technician: ['service.view', 'service.self_edit'],
  accountant: ['invoices.view', 'invoices.edit'],
  viewer: ['leads.view', 'jobs.view', 'invoices.view', 'service.view'],
  // legacy
  staff: ['leads.view', 'leads.edit', 'jobs.view', 'service.view', 'service.self_edit'],
};

export function can(role: Role | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const perms = byRole[role] || [];
  return perms.includes(perm);
}

export function isAdminish(role: Role | null | undefined) {
  return role === 'owner' || role === 'admin';
}

