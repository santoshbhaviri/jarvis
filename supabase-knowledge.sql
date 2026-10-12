-- ============================================================
-- JARVIS: your Knowledge store (run once in Supabase, SQL Editor)
-- Keeps your notes and preferences, your documents and your Assist chats in your own
-- Supabase database. Each login sees only its own rows. Safe to run more than once:
-- it only adds what is missing and never deletes anything.
-- ============================================================

-- Notes: preferences, facts, people, decisions and saved answers, read before every answer
create table if not exists public.jarvis_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null,
  title      text,
  source     text not null default 'you',   -- you, assist, search, claude, learned
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  words      tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || text)) stored
);
create index if not exists jarvis_notes_user_idx  on public.jarvis_notes (user_id, created_at desc);
create index if not exists jarvis_notes_words_idx on public.jarvis_notes using gin (words);

-- Library: whole documents (the Acts and Rules, notices, orders), kept as passages
create table if not exists public.jarvis_documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  pages      integer not null default 0,
  chars      integer not null default 0,
  ready      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists jarvis_documents_user_idx on public.jarvis_documents (user_id, created_at desc);

create table if not exists public.jarvis_passages (
  doc_id  uuid not null references public.jarvis_documents(id) on delete cascade,
  seq     integer not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page    integer not null default 0,
  text    text not null,
  words   tsvector generated always as (to_tsvector('english', text)) stored,
  primary key (doc_id, seq)
);
create index if not exists jarvis_passages_user_idx  on public.jarvis_passages (user_id);
create index if not exists jarvis_passages_words_idx on public.jarvis_passages using gin (words);

-- Chats: each question and answer in Assist, so Jarvis can recall earlier conversations
create table if not exists public.jarvis_chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question   text not null,
  answer     text not null,
  created_at timestamptz not null default now(),
  words      tsvector generated always as (to_tsvector('english', question || ' ' || answer)) stored
);
create index if not exists jarvis_chats_user_idx  on public.jarvis_chats (user_id, created_at desc);
create index if not exists jarvis_chats_words_idx on public.jarvis_chats using gin (words);

-- Each login sees and changes only its own rows
alter table public.jarvis_notes     enable row level security;
alter table public.jarvis_documents enable row level security;
alter table public.jarvis_passages  enable row level security;
alter table public.jarvis_chats     enable row level security;
do $$
declare t text;
begin
  foreach t in array array['jarvis_notes', 'jarvis_documents', 'jarvis_passages', 'jarvis_chats'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'own_' || t) then
      execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', 'own_' || t, t);
    end if;
  end loop;
end $$;
revoke all on public.jarvis_notes, public.jarvis_documents, public.jarvis_passages, public.jarvis_chats from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.jarvis_notes, public.jarvis_documents, public.jarvis_passages, public.jarvis_chats to authenticated;

-- The Library passages that best match a question, for Jarvis to rank. q is words joined by | ;
-- heads finds the start of a section or rule ("73. (1) Where…"), which counts first. Then
-- passages with more of the question's words, rare words counting most.
create or replace function public.jarvis_search(q text, heads text default null, how_many integer default 200)
returns table (doc_id uuid, seq integer, page integer, text text, name text)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with ask as (
    select case when to_tsvector('english', replace(coalesce(q, ''), '|', ' ')) <> ''::tsvector
                then to_tsquery('english', q) end as tq,
           nullif(heads, '') as hd
  ),
  hits as materialized (
    select p.doc_id, p.seq, p.page, p.text, p.words, d.name,
           coalesce(p.text ~* ask.hd, false) as head,
           coalesce(ts_rank_cd(p.words, ask.tq), 0) as rank
    from ask, public.jarvis_passages p
    join public.jarvis_documents d on d.id = p.doc_id and d.ready
    where p.user_id = auth.uid()
      and (p.words @@ ask.tq or p.text ~* ask.hd)
  ),
  words as (
    select distinct quote_literal(w)::tsquery as w
    from unnest(tsvector_to_array(to_tsvector('english', replace(coalesce(q, ''), '|', ' ')))) as w
  ),
  rare as materialized (
    select words.w, ln(1 + (select count(*) from hits)::float8 / count(*)) as weight
    from words join hits on hits.words @@ words.w
    group by words.w
  )
  select h.doc_id, h.seq, h.page, h.text, h.name
  from hits h
  order by h.head desc,
    (select coalesce(sum(rare.weight), 0) from rare where h.words @@ rare.w) desc,
    h.rank desc
  limit least(greatest(how_many, 1), 400)
$$;

-- Tells Jarvis this setup has run (and which version of it)
create or replace function public.jarvis_store_version()
returns integer language sql immutable as $$ select 1 $$;

revoke execute on function public.jarvis_search(text, text, integer) from public, anon;
revoke execute on function public.jarvis_store_version() from public, anon;
grant execute on function public.jarvis_search(text, text, integer) to authenticated;
grant execute on function public.jarvis_store_version() to authenticated;

notify pgrst, 'reload schema';
