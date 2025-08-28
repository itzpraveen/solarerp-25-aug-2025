-- Fix audit trigger function to avoid referencing non-existent columns
-- Previous version used NEW.invoice_id/NEW.job_id which fails on tables without those fields.

create or replace function public.audit_log_change() returns trigger as $$
declare
  acting_user uuid;
  action_text text;
  entity_text text;
  entity_id_text text;
  payload jsonb;
begin
  -- who
  begin
    acting_user := auth.uid();
  exception when others then
    acting_user := null;
  end;

  entity_text := tg_table_name;

  if tg_op = 'INSERT' then
    action_text := lower(tg_table_name) || '.insert';
    payload := to_jsonb(new);
    -- use primary key id where available (all our audited tables have id)
    entity_id_text := coalesce((payload->>'id'), (payload->>'job_id'), (payload->>'invoice_id'));
    insert into public.audit_logs(tenant_id, user_id, action, entity, entity_id, metadata)
      values (new.tenant_id, acting_user, action_text, entity_text, entity_id_text, payload);
    return new;
  elsif tg_op = 'DELETE' then
    action_text := lower(tg_table_name) || '.delete';
    payload := to_jsonb(old);
    entity_id_text := coalesce((payload->>'id'), (payload->>'job_id'), (payload->>'invoice_id'));
    insert into public.audit_logs(tenant_id, user_id, action, entity, entity_id, metadata)
      values (old.tenant_id, acting_user, action_text, entity_text, entity_id_text, payload);
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate triggers to pick up function changes (idempotent)
drop trigger if exists trg_audit_invoices_ins on public.invoices;
create trigger trg_audit_invoices_ins after insert on public.invoices
  for each row execute function public.audit_log_change();

drop trigger if exists trg_audit_payments_ins on public.payments;
create trigger trg_audit_payments_ins after insert on public.payments
  for each row execute function public.audit_log_change();

drop trigger if exists trg_audit_documents_ins on public.documents;
create trigger trg_audit_documents_ins after insert on public.documents
  for each row execute function public.audit_log_change();

drop trigger if exists trg_audit_documents_del on public.documents;
create trigger trg_audit_documents_del after delete on public.documents
  for each row execute function public.audit_log_change();

