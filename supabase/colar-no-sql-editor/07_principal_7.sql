-- Cabeça Leve, passo 7 de 20: banco principal (tabelas transactions, budgets).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type in ('expense', 'income', 'transfer', 'adjustment', 'card_payment')),
  status text not null default 'posted' check (status in ('posted', 'planned', 'skipped')),
  amount_cents bigint not null,
  currency char(3) not null default 'BRL',
  occurred_on date not null,              
  description text not null check (length(description) between 1 and 200),
  merchant text,
  category_id uuid,
  account_id uuid,
  card_id uuid,
  invoice_id uuid,                        
  counterpart_account_id uuid,            
  project_id uuid,                        
  payment_method text
    check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other')),
  installment_purchase_id uuid,
  installment_number smallint,
  recurrence_id uuid,
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'whatsapp', 'import', 'recurrence', 'installment')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id),
  foreign key (invoice_id, user_id)
    references public.card_invoices (id, user_id) on delete set null (invoice_id),
  foreign key (counterpart_account_id, user_id) references public.accounts (id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id),
  foreign key (installment_purchase_id, user_id)
    references public.installment_purchases (id, user_id) on delete cascade,
  foreign key (recurrence_id, user_id)
    references public.recurrences (id, user_id) on delete set null (recurrence_id),
  check (case when type = 'adjustment' then amount_cents <> 0 else amount_cents > 0 end),
  check (card_id is null or account_id is null),
  check (type <> 'transfer' or (account_id is not null and counterpart_account_id is not null
                                and account_id <> counterpart_account_id)),
  check (type = 'transfer' or counterpart_account_id is null),
  check (type <> 'card_payment' or (account_id is not null and invoice_id is not null)),
  check ((installment_purchase_id is null) = (installment_number is null)),
  unique (installment_purchase_id, installment_number),
  unique (recurrence_id, occurred_on)     
);

create index on public.transactions (user_id, occurred_on desc);

create index on public.transactions (user_id, status, occurred_on);

create index on public.transactions (category_id);

create index on public.transactions (account_id);

create index on public.transactions (card_id);

create index on public.transactions (invoice_id);

create index on public.transactions (counterpart_account_id);

create index on public.transactions (project_id);

create index on public.transactions (installment_purchase_id);

create index on public.transactions (recurrence_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  period text not null default 'monthly' check (period in ('monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  unique (category_id, period)
);

commit;
