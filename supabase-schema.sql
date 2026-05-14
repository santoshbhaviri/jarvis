-- ============================================================
-- TaskFlow — Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tasks table
create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  category    text not null default 'work'      check (category in ('work','personal')),
  priority    text not null default 'medium'    check (priority in ('high','medium','low')),
  status      text not null default 'todo'      check (status in ('todo','inprogress','followup','done')),
  due_date    date,
  followup_date date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on any row change
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

-- Row-level security (open for demo; add auth later)
alter table public.tasks enable row level security;

create policy "Allow all operations" on public.tasks
  for all using (true) with check (true);

-- Indexes for common queries
create index if not exists tasks_status_idx    on public.tasks(status);
create index if not exists tasks_due_date_idx  on public.tasks(due_date);
create index if not exists tasks_category_idx  on public.tasks(category);
create index if not exists tasks_created_at_idx on public.tasks(created_at desc);
