-- Cabeça Leve, passo 8 de 20: banco principal (tabelas statement_imports, goals, goal_entries, notebooks).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attachment_id uuid not null,
  card_id uuid,
  account_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'confirmed', 'failed', 'discarded')),
  items jsonb not null default '[]',      
  confirmed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (attachment_id, user_id)
    references public.attachments (id, user_id) on delete cascade,
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete set null (card_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id)
);

create index on public.statement_imports (user_id, created_at desc);

create index on public.statement_imports (attachment_id);

create index on public.statement_imports (card_id);

create index on public.statement_imports (account_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('financial', 'habit', 'project', 'custom')),
  target_value numeric(14, 2) not null check (target_value > 0),
  unit text,                              
  deadline date,
  monthly_plan numeric(14, 2),            
  account_id uuid,
  habit_id uuid,
  project_id uuid,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete set null (habit_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id),
  check (num_nonnulls(account_id, habit_id, project_id) <= 1)
);

create index on public.goals (user_id, status);

create index on public.goals (account_id);

create index on public.goals (habit_id);

create index on public.goals (project_id);

create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  value numeric(14, 2) not null,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);

create index on public.goal_entries (goal_id, occurred_on);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(name) between 1 and 80),
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references public.notebooks (id, user_id) on delete cascade,
  unique nulls not distinct (user_id, parent_id, name)
);

create index on public.notebooks (parent_id);

commit;
