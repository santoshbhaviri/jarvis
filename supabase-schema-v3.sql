-- ============================================================
-- JARVIS — Schema v3 (run this in Supabase SQL Editor)
-- Adds: login (each person sees only their own tasks), important flag,
-- habit goals, the 30-day Done bin and push reminders.
-- Safe to run more than once. Run supabase-schema-update.sql first
-- if you have not already.
-- ============================================================

-- 1. New task columns
alter table public.tasks add column if not exists user_id      uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.tasks add column if not exists important    boolean not null default false;
alter table public.tasks add column if not exists urgent       boolean not null default false;
alter table public.tasks add column if not exists waiting_on   text;
alter table public.tasks add column if not exists follow_up    date;
alter table public.tasks add column if not exists focus_date   date;          -- "Top 3 for today"
alter table public.tasks add column if not exists postponed    integer not null default 0;
alter table public.tasks add column if not exists completed_at timestamptz;   -- set when a task is finished (kept 30 days in the Done bin)
alter table public.tasks add column if not exists target_per_week integer;     -- habit goal, e.g. gym 4 days a week

create index if not exists tasks_user_idx      on public.tasks(user_id);
create index if not exists tasks_follow_up_idx on public.tasks(follow_up);

-- 2. Push subscriptions (one row per phone / browser that allowed reminders)
create table if not exists public.push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint     text not null unique,
  subscription jsonb not null,
  remind_at    time not null default '08:00',   -- local time for the morning summary
  tz_offset    integer not null default 330,    -- minutes east of UTC (India = 330)
  last_sent_on date,
  created_at   timestamptz not null default now()
);

-- 3. Replace the old "allow everyone" policies with per-user policies
alter table public.push_subscriptions enable row level security;

drop policy if exists "allow_all_tasks"   on public.tasks;
drop policy if exists "allow_all_routine" on public.routine_completions;
drop policy if exists "allow_all_daily"   on public.daily_completions;
drop policy if exists "own_tasks"         on public.tasks;
drop policy if exists "own_routine"       on public.routine_completions;
drop policy if exists "own_daily"         on public.daily_completions;
drop policy if exists "own_push"          on public.push_subscriptions;

create policy "own_tasks" on public.tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_routine" on public.routine_completions for all
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

create policy "own_daily" on public.daily_completions for all
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

create policy "own_push" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Claim your existing tasks.
-- Sign in to the app once first, then replace the email below with yours and run
-- only this statement. Until you do, your old tasks stay hidden (they have no owner).
--
-- update public.tasks
--   set user_id = (select id from auth.users where email = 'you@example.com')
--   where user_id is null;
