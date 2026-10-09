-- Cabeça Leve, passo 4 de 20: banco principal (tabelas recurrences, project_templates, projects, milestones).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('subscription', 'bill', 'income')),
  description text not null check (length(description) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  category_id uuid,
  account_id uuid,
  card_id uuid,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  interval_count smallint not null default 1 check (interval_count between 1 and 12),
  anchor_on date not null,                
  ends_on date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete set null (card_id),
  check (num_nonnulls(card_id, account_id) <= 1),
  check (ends_on is null or ends_on >= anchor_on)
);

create index on public.recurrences (user_id);

create index on public.recurrences (category_id);

create index on public.recurrences (account_id);

create index on public.recurrences (card_id);

create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  definition jsonb not null default '{}',  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index on public.project_templates (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  starts_on date,
  due_on date,
  budget_cents bigint check (budget_cents is null or budget_cents >= 0),
  currency char(3) not null default 'BRL',
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (template_id, user_id)
    references public.project_templates (id, user_id) on delete set null (template_id),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);

create index on public.projects (user_id, status);

create index on public.projects (template_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  due_on date,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade
);

create index on public.milestones (project_id, position);

commit;
