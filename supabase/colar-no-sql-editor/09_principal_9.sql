-- Cabeça Leve, passo 9 de 20: banco principal (tabelas notes, note_links, journal_entries, embeddings, integrations).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid,
  title text not null default '' check (length(title) <= 200),
  content text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'voice', 'whatsapp', 'web_research')),
  in_inbox boolean not null default false,  
  pinned boolean not null default false,
  archived_at timestamptz,
  search tsvector generated always as
    (to_tsvector('public.pt_unaccent', coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (notebook_id, user_id)
    references public.notebooks (id, user_id) on delete set null (notebook_id),
  check (length(title) > 0 or length(content) > 0)
);

create index on public.notes (user_id, updated_at desc);

create index on public.notes (notebook_id);

create index on public.notes using gin (search);

create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_note_id uuid not null,
  to_note_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (from_note_id, user_id) references public.notes (id, user_id) on delete cascade,
  foreign key (to_note_id, user_id) references public.notes (id, user_id) on delete cascade,
  unique (from_note_id, to_note_id),
  check (from_note_id <> to_note_id)
);

create index on public.note_links (to_note_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_on date not null,
  content text not null check (length(content) > 0),
  search tsvector generated always as (to_tsvector('public.pt_unaccent', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.journal_entries (user_id, entry_on desc);

create index on public.journal_entries using gin (search);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('note', 'journal', 'message')),
  source_id uuid not null,
  chunk_index smallint not null default 0,
  content text not null,
  embedding vector(1024) not null,
  model text not null,                    
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index, model)
);

create index on public.embeddings (user_id, source_type);

create index on public.embeddings using hnsw (embedding vector_cosine_ops);

create or replace function public.delete_embeddings() returns trigger
language plpgsql as $$
begin
  delete from public.embeddings
  where source_type = tg_argv[0] and source_id = old.id;
  return old;
end $$;

create trigger notes_delete_embeddings after delete on public.notes
  for each row execute function public.delete_embeddings('note');

create trigger journal_delete_embeddings after delete on public.journal_entries
  for each row execute function public.delete_embeddings('journal');

create trigger messages_delete_embeddings after delete on public.messages
  for each row execute function public.delete_embeddings('message');

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'strava')),
  account_email text,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique nulls not distinct (user_id, provider, account_email)
);

commit;
