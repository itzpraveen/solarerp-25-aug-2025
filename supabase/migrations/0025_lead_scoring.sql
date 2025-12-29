-- Lead scoring: columns, function, trigger, and backfill

-- 1) Columns
alter table public.leads
  add column if not exists score int default 0,
  add column if not exists score_breakdown jsonb default '{}'::jsonb;

create index if not exists idx_leads_score on public.leads(score);

-- 2) Scoring function and trigger
create or replace function public.leads_recompute_score()
returns trigger
language plpgsql
as $$
declare
  s int := 0;
  due int := 0;
  contact int := 0;
  capacity int := 0;
  source_w int := 0;
  status_w int := 0;
  today date := current_date;
  days_since_contact int := null;
begin
  -- Due date contribution
  if new.next_follow_up_date is not null then
    if new.next_follow_up_date < today then
      due := 25; -- overdue
    elsif new.next_follow_up_date = today then
      due := 15; -- due today
    end if;
  end if;

  -- Last contact recency (older -> higher priority)
  if new.last_contacted_at is null then
    contact := 12; -- never contacted
  else
    days_since_contact := greatest(0, (today - new.last_contacted_at));
    if days_since_contact >= 30 then
      contact := 12;
    elsif days_since_contact >= 14 then
      contact := 10;
    elsif days_since_contact >= 7 then
      contact := 8;
    elsif days_since_contact >= 3 then
      contact := 6;
    else
      contact := 3;
    end if;
  end if;

  -- Capacity buckets
  if new.interested_capacity_kw is not null then
    if new.interested_capacity_kw >= 10 then
      capacity := 15;
    elsif new.interested_capacity_kw >= 5 then
      capacity := 10;
    elsif new.interested_capacity_kw >= 3 then
      capacity := 6;
    elsif new.interested_capacity_kw >= 1 then
      capacity := 4;
    else
      capacity := 2;
    end if;
  end if;

  -- Source weighting (tweakable)
  if coalesce(new.source, '') ilike 'referral%' then
    source_w := 15;
  elsif coalesce(new.source, '') ilike 'inbound%' or coalesce(new.source, '') ilike 'website%' then
    source_w := 10;
  elsif coalesce(new.source, '') ilike 'google%' or coalesce(new.source, '') ilike 'walk%in%' then
    source_w := 8;
  elsif coalesce(new.source, '') ilike 'facebook%' or coalesce(new.source, '') ilike 'ad%' or coalesce(new.source, '') ilike 'campaign%' then
    source_w := 6;
  elsif coalesce(new.source, '') ilike 'cold%call%' then
    source_w := 3;
  else
    source_w := 5; -- default
  end if;

  -- Status influence (de-emphasize closed states)
  if coalesce(new.status, '') ilike 'Converted' then
    status_w := -50;
  elsif coalesce(new.status, '') ilike 'Lost' then
    status_w := -40;
  else
    status_w := 0;
  end if;

  s := greatest(0, due + contact + capacity + source_w + status_w);
  new.score := s;
  new.score_breakdown := jsonb_build_object(
    'due', due,
    'contact', contact,
    'capacity', capacity,
    'source', source_w,
    'status', status_w
  );
  return new;
end;
$$;

drop trigger if exists trg_leads_recompute_score on public.leads;
create trigger trg_leads_recompute_score
before insert or update on public.leads
for each row execute function public.leads_recompute_score();

-- 3) Backfill existing rows (runs with migration privileges)
update public.leads set score = score; -- fires trigger

