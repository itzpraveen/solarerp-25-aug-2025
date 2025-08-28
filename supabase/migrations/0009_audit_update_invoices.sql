-- Audit UPDATEs on invoices to capture status/amount changes

create or replace function public.audit_log_invoice_update() returns trigger as $$
declare
  acting_user uuid;
begin
  begin
    acting_user := auth.uid();
  exception when others then
    acting_user := null;
  end;

  if (old.status is distinct from new.status)
     or (old.total is distinct from new.total)
     or (old.due_date is distinct from new.due_date) then
    insert into public.audit_logs(tenant_id, user_id, action, entity, entity_id, metadata)
    values (
      new.tenant_id,
      acting_user,
      'invoices.update',
      'invoices',
      new.id::text,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_total', old.total,
        'new_total', new.total,
        'old_due_date', old.due_date,
        'new_due_date', new.due_date
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_audit_invoices_upd on public.invoices;
create trigger trg_audit_invoices_upd after update on public.invoices
  for each row execute function public.audit_log_invoice_update();

