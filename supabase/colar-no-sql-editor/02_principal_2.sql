-- Cabeça Leve, passo 2 de 22: banco principal (tabelas messages, attachments, actions, memories).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  seq integer not null check (seq >= 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'voice', 'job')),
  content jsonb not null,
  text_preview text,
  client_message_id text,                 
  external_message_id text,               
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade,
  unique (conversation_id, seq),
  unique (user_id, client_message_id),
  unique (channel, external_message_id)
);

create index on public.messages (conversation_id);

create index on public.messages (user_id, created_at desc);

create or replace function public.forbid_message_edit() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content
     or new.role is distinct from old.role
     or new.seq is distinct from old.seq
     or new.conversation_id is distinct from old.conversation_id then
    raise exception 'messages é somente-anexar: o histórico da conversa não pode ser editado';
  end if;
  return new;
end $$;

create trigger messages_append_only before update on public.messages
  for each row execute function public.forbid_message_edit();

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid,
  kind text not null check (kind in ('audio', 'image', 'document')),
  storage_path text not null unique,      
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),  
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  transcript text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete cascade
);

create index on public.attachments (message_id);

create index on public.attachments (user_id, created_at desc);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid,                        
  tool_name text not null,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete set null (message_id),
  check (operation = 'create' or before is not null),
  check (operation = 'delete' or after is not null)
);

create index on public.actions (message_id);

create index on public.actions (user_id, created_at desc);

create index on public.actions (entity_table, entity_id);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fact text not null check (length(fact) between 1 and 500),
  source_message_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_message_id, user_id)
    references public.messages (id, user_id) on delete set null (source_message_id)
);

create index on public.memories (user_id) where archived_at is null;

create index on public.memories (source_message_id);

commit;
