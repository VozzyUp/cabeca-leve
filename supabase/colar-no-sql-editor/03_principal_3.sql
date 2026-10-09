-- Cabeça Leve, passo 3 de 20: banco principal (tabelas categories, accounts, cards, card_invoices, installment_purchases).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(name) between 1 and 60),
  kind text not null check (kind in ('expense', 'income')),
  color text,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  unique nulls not distinct (user_id, parent_id, name)
);

create index on public.categories (parent_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  institution text,
  kind text not null default 'checking'
    check (kind in ('checking', 'savings', 'cash', 'investment', 'wallet')),
  currency char(3) not null default 'BRL',
  opening_balance_cents bigint not null default 0,
  opening_balance_on date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index on public.accounts (user_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  institution text,
  limit_cents bigint not null check (limit_cents >= 0),
  currency char(3) not null default 'BRL',
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid,                
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (payment_account_id, user_id)
    references public.accounts (id, user_id) on delete set null (payment_account_id)
);

create index on public.cards (user_id);

create index on public.cards (payment_account_id);

create table public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  closes_on date not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete cascade,
  unique (card_id, reference_month),
  check (due_on >= closes_on),
  check ((status = 'paid') = (paid_at is not null))
);

create index on public.card_invoices (user_id, due_on);

create table public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid,
  account_id uuid,
  category_id uuid,
  description text not null check (length(description) between 1 and 200),
  total_cents bigint not null check (total_cents > 0),
  currency char(3) not null default 'BRL',
  installments_count smallint not null check (installments_count between 2 and 72),
  first_due_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  check (num_nonnulls(card_id, account_id) = 1)
);

create index on public.installment_purchases (user_id);

create index on public.installment_purchases (card_id);

create index on public.installment_purchases (account_id);

create index on public.installment_purchases (category_id);

commit;
