-- ============================================================
-- JARVIS — Supabase Schema (Fixed)
-- Paste this ENTIRE file into Supabase SQL Editor and click Run
-- ============================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Drop and recreate tables cleanly
drop table if exists public.daily_completions cascade;
drop table if exists public.routine_completions cascade;
drop table if exists public.tasks cascade;

-- 3. Tasks table
create table public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  category        text not null default 'work'
                    check (category in ('work','personal')),
  status          text not null default 'routine'
                    check (status in ('routine','scut-work','mission')),
  due_date        date,
  notes           text,
  is_extended     boolean not null default false,
  extended_from   uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 4. Routine completions (7-day tracker)
create table public.routine_completions (
  id        uuid primary key default uuid_generate_v4(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  date      date not null,
  created_at timestamptz not null default now(),
  unique(task_id, date)
);

-- 5. Daily completions (checkbox per task per day)
create table public.daily_completions (
  id        uuid primary key default uuid_generate_v4(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  date      date not null,
  created_at timestamptz not null default now(),
  unique(task_id, date)
);

-- 6. Auto-update updated_at trigger
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

-- 7. Enable Row Level Security
alter table public.tasks               enable row level security;
alter table public.routine_completions enable row level security;
alter table public.daily_completions   enable row level security;

-- 8. Drop existing policies (in case of re-run)
drop policy if exists "allow_all_tasks"    on public.tasks;
drop policy if exists "allow_all_routine"  on public.routine_completions;
drop policy if exists "allow_all_daily"    on public.daily_completions;

-- 9. Create open policies (no auth required)
create policy "allow_all_tasks"
  on public.tasks for all
  using (true) with check (true);

create policy "allow_all_routine"
  on public.routine_completions for all
  using (true) with check (true);

create policy "allow_all_daily"
  on public.daily_completions for all
  using (true) with check (true);

-- 10. Indexes
create index if not exists tasks_status_idx     on public.tasks(status);
create index if not exists tasks_category_idx   on public.tasks(category);
create index if not exists tasks_due_date_idx   on public.tasks(due_date);
create index if not exists tasks_created_at_idx on public.tasks(created_at desc);
create index if not exists rc_task_date_idx     on public.routine_completions(task_id, date);
create index if not exists dc_task_date_idx     on public.daily_completions(task_id, date);
