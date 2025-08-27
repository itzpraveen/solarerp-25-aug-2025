import { describe, it, expect } from 'vitest';
import { can } from '@/lib/authz';

describe('authz.can()', () => {
  it('treats owner and admin as full access for key perms', () => {
    expect(can('owner', 'settings.manage')).toBe(true);
    expect(can('admin', 'settings.manage')).toBe(true);
    expect(can('owner', 'team.manage')).toBe(true);
    expect(can('admin', 'team.manage')).toBe(true);
  });

  it('enforces read-only viewer permissions', () => {
    expect(can('viewer', 'leads.view')).toBe(true);
    expect(can('viewer', 'jobs.view')).toBe(true);
    expect(can('viewer', 'invoices.view')).toBe(true);
    expect(can('viewer', 'service.view')).toBe(true);
    expect(can('viewer', 'leads.edit')).toBe(false);
    expect(can('viewer', 'jobs.edit')).toBe(false);
  });

  it('grants limited perms to technician and accountant', () => {
    expect(can('technician', 'service.self_edit')).toBe(true);
    expect(can('technician', 'leads.view')).toBe(false);
    expect(can('accountant', 'invoices.edit')).toBe(true);
    expect(can('accountant', 'jobs.edit')).toBe(false);
  });
});
