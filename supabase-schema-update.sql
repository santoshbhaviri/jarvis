-- ============================================================
-- JARVIS — Schema Update (run this in Supabase SQL Editor)
-- Adds is_unfinished column to tasks table
-- ============================================================

-- Add is_unfinished flag (safe to run even if column already exists)
alter table public.tasks
  add column if not exists is_unfinished boolean not null default false;

-- Index for quick lookup of unfinished tasks
create index if not exists tasks_unfinished_idx on public.tasks(is_unfinished);
