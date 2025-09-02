-- Additional indexes for frequent filters/sorts
-- Leads follow-up and branch filters
create index if not exists idx_leads_next_follow_up on public.leads(next_follow_up_date);
create index if not exists idx_leads_branch_next_follow_up on public.leads(branch_id, next_follow_up_date);

-- Tasks due date for dashboard widgets
create index if not exists idx_tasks_due_date on public.tasks(due_date);

