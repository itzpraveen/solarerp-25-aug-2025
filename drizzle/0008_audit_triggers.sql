-- Audit triggers for sensitive tables: invoices, payments, documents

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

  -- what
  if tg_op = 'INSERT' then
    action_text := lower(tg_table_name) || '.insert';
    entity_text := tg_table_name;
    entity_id_text := coalesce(new.id::text, coalesce(new.invoice_id::text, new.job_id::text));
    payload := to_jsonb(new);
    insert into public.audit_logs(tenant_id, user_id, action, entity, entity_id, metadata)
      values (new.tenant_id, acting_user, action_text, entity_text, entity_id_text, payload);
    return new;
  elsif tg_op = 'DELETE' then
    action_text := lower(tg_table_name) || '.delete';
    entity_text := tg_table_name;
    entity_id_text := coalesce(old.id::text, coalesce(old.invoice_id::text, old.job_id::text));
    payload := to_jsonb(old);
    insert into public.audit_logs(tenant_id, user_id, action, entity, entity_id, metadata)
      values (old.tenant_id, acting_user, action_text, entity_text, entity_id_text, payload);
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Invoices
drop trigger if exists trg_audit_invoices_ins on public.invoices;
create trigger trg_audit_invoices_ins after insert on public.invoices
  for each row execute function public.audit_log_change();

-- Payments
drop trigger if exists trg_audit_payments_ins on public.payments;
create trigger trg_audit_payments_ins after insert on public.payments
  for each row execute function public.audit_log_change();

-- Documents (insert + delete)
drop trigger if exists trg_audit_documents_ins on public.documents;
create trigger trg_audit_documents_ins after insert on public.documents
  for each row execute function public.audit_log_change();

drop trigger if exists trg_audit_documents_del on public.documents;
create trigger trg_audit_documents_del after delete on public.documents
  for each row execute function public.audit_log_change();

