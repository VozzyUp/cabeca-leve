-- Cabeça Leve, passo 13 de 22: banco principal (tabelas body_measurements, health_samples).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weight', 'body_fat', 'waist', 'chest', 'arm', 'thigh', 'hip')),
  value numeric(7, 2) not null check (value > 0),
  unit text not null check (unit in ('kg', '%', 'cm')),
  measured_at timestamptz not null,
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'apple_health', 'health_connect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'weight' and unit = 'kg') or (kind = 'body_fat' and unit = '%')
         or (kind not in ('weight', 'body_fat') and unit = 'cm'))
);

create index on public.body_measurements (user_id, kind, measured_at desc);

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('steps', 'distance', 'active_calories', 'sleep', 'heart_rate')),
  value numeric(12, 2) not null,
  unit text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null check (source in ('apple_health', 'health_connect', 'strava')),
  external_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  check (ends_at >= starts_at)
);

create index on public.health_samples (user_id, kind, starts_at desc);

create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.opening_balance_cents + coalesce(sum(
    case
      when t.account_id = a.id and t.type in ('income', 'adjustment') then t.amount_cents
      when t.account_id = a.id and t.type in ('expense', 'card_payment', 'transfer') then -t.amount_cents
      when t.counterpart_account_id = a.id and t.type = 'transfer' then t.amount_cents
      else 0
    end), 0) as balance_cents
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
 and (t.account_id = a.id or t.counterpart_account_id = a.id)
 and t.status = 'posted'
 and t.occurred_on >= a.opening_balance_on
group by a.id, a.user_id, a.opening_balance_cents;

create view public.card_invoice_totals with (security_invoker = true) as
select
  i.id as invoice_id,
  i.user_id,
  i.card_id,
  coalesce(sum(t.amount_cents) filter (where t.type = 'expense' and t.status <> 'skipped'), 0)
    as total_cents
from public.card_invoices i
left join public.transactions t on t.invoice_id = i.id and t.user_id = i.user_id
group by i.id, i.user_id, i.card_id;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);

  insert into public.categories (user_id, name, kind)
  select new.id, c.name, c.kind
  from (values
    ('Alimentação', 'expense'), ('Mercado', 'expense'), ('Transporte', 'expense'),
    ('Moradia', 'expense'), ('Contas da casa', 'expense'), ('Saúde', 'expense'),
    ('Educação', 'expense'), ('Lazer', 'expense'), ('Compras', 'expense'),
    ('Assinaturas', 'expense'), ('Outros gastos', 'expense'),
    ('Salário', 'income'), ('Freelance', 'income'), ('Outras entradas', 'income')
  ) as c (name, kind);

  insert into public.alert_rules (user_id, kind, threshold)
  values
    (new.id, 'bill_due', 2),               -- dias antes do vencimento
    (new.id, 'card_limit', 0.90),
    (new.id, 'income_committed', 0.70),
    (new.id, 'project_stalled', 21),       -- dias sem movimento
    (new.id, 'habit_overdue', 60),         -- minutos depois do horário
    (new.id, 'task_overdue', 30),
    (new.id, 'next_month_squeeze', 0.80),
    (new.id, 'day_complete', null);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
