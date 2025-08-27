import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type AuditEvent = {
  tenantId: string;
  userId?: string | null;
  action: string; // e.g., 'jobs.update_status', 'team.invite'
  entity?: string; // e.g., 'jobs'
  entityId?: string; // e.g., job id
  metadata?: Record<string, unknown>;
};

// Insert an audit log using the provided (RLS-bound) client.
export async function logAudit(sb: SupabaseClient, evt: AuditEvent) {
  try {
    await sb.from('audit_logs').insert({
      tenant_id: evt.tenantId,
      user_id: evt.userId || null,
      action: evt.action,
      entity: evt.entity || null,
      entity_id: evt.entityId || null,
      metadata: evt.metadata || null,
    });
  } catch {}
}
