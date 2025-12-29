-- Aggregate Overview KPIs in a single DB round trip.
-- Uses GROUP BY ROLLUP + conditional aggregation to compute per-branch, unassigned, and total rows.
-- RLS applies normally; do not use SECURITY DEFINER.

create or replace function public.overview_kpis_agg(
  _today date,
  _sow date,
  _month date
)
returns table (
  branch_id uuid,
  is_total boolean,
  total bigint,
  open bigint,
  due_today bigint,
  overdue bigint,
  new_week bigint,
  converted_total bigint,
  leads_new_month bigint,
  leads_converted_month bigint,
  proposals_week bigint,
  proposals_month bigint
)
language sql
stable
as $$
  with leads_agg as (
    select
      l.branch_id,
      grouping(l.branch_id) = 1 as is_total,
      count(*) as total,
      count(*) filter (where l.status not in ('Closed','Converted','Lost')) as open,
      count(*) filter (where l.next_follow_up_date = _today and l.status not in ('Closed','Converted','Lost')) as due_today,
      count(*) filter (where l.next_follow_up_date <= _today and l.status not in ('Closed','Converted','Lost')) as overdue,
      count(*) filter (where l.date >= _sow) as new_week,
      count(*) filter (where l.status = 'Converted') as converted_total,
      count(*) filter (where l.date >= _month) as leads_new_month,
      count(*) filter (where l.status = 'Converted' and l.date >= _month) as leads_converted_month
    from public.leads l
    group by rollup(l.branch_id)
  ),
  prop_agg as (
    select
      j.branch_id,
      grouping(j.branch_id) = 1 as is_total,
      count(*) filter (where p.date >= _sow) as proposals_week,
      count(*) filter (where p.date >= _month) as proposals_month
    from public.proposals p
    join public.jobs j on j.id = p.job_id
    group by rollup(j.branch_id)
  )
  select
    coalesce(l.branch_id, p.branch_id) as branch_id,
    coalesce(l.is_total, p.is_total) as is_total,
    l.total,
    l.open,
    l.due_today,
    l.overdue,
    l.new_week,
    l.converted_total,
    l.leads_new_month,
    l.leads_converted_month,
    p.proposals_week,
    p.proposals_month
  from leads_agg l
  full outer join prop_agg p
    on (l.branch_id is not distinct from p.branch_id and l.is_total is not distinct from p.is_total)
  order by is_total asc nulls last, branch_id nulls last;
$$;

