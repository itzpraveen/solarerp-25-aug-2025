-- Fix overview KPI aggregation without full outer join.
-- Uses UNION ALL + GROUP BY to combine lead and proposal aggregates.

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
  ),
  unioned as (
    select
      branch_id,
      is_total,
      total,
      open,
      due_today,
      overdue,
      new_week,
      converted_total,
      leads_new_month,
      leads_converted_month,
      null::bigint as proposals_week,
      null::bigint as proposals_month
    from leads_agg
    union all
    select
      branch_id,
      is_total,
      null::bigint as total,
      null::bigint as open,
      null::bigint as due_today,
      null::bigint as overdue,
      null::bigint as new_week,
      null::bigint as converted_total,
      null::bigint as leads_new_month,
      null::bigint as leads_converted_month,
      proposals_week,
      proposals_month
    from prop_agg
  )
  select
    branch_id,
    is_total,
    coalesce(sum(total), 0) as total,
    coalesce(sum(open), 0) as open,
    coalesce(sum(due_today), 0) as due_today,
    coalesce(sum(overdue), 0) as overdue,
    coalesce(sum(new_week), 0) as new_week,
    coalesce(sum(converted_total), 0) as converted_total,
    coalesce(sum(leads_new_month), 0) as leads_new_month,
    coalesce(sum(leads_converted_month), 0) as leads_converted_month,
    coalesce(sum(proposals_week), 0) as proposals_week,
    coalesce(sum(proposals_month), 0) as proposals_month
  from unioned
  group by branch_id, is_total
  order by is_total asc nulls last, branch_id nulls last;
$$;
