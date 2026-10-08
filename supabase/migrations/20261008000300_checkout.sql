-- Páginas de pagamento abertas na Asaas: ligam o checkout (id da Asaas) à conta que pediu.
create table public.checkout_sessions (
  id text primary key,                    -- id do checkout na Asaas
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.checkout_sessions (user_id);
alter table public.checkout_sessions enable row level security;
create policy checkout_sessions_select_own on public.checkout_sessions for select to authenticated using (user_id = (select auth.uid()));
create trigger checkout_sessions_set_updated_at before update on public.checkout_sessions for each row execute function public.set_updated_at();
