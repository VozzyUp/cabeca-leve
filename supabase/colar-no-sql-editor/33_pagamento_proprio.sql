-- Peraí, passo 33 de 33: pagamento dentro do app (Pix, boleto e cartão pela API da Asaas).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 32.
-- (Se a Action de deploy já aplicou as migrações, não rode: as colunas já existiriam e dá erro.)
-- Deve terminar com uma linha de conferência: tabela_clientes = true, colunas = 4.

begin;

-- Pagamento dentro do app (Pix, boleto ou cartão pela API da Asaas, sem abrir a página de checkout deles).
-- checkout_sessions passa a guardar cada tentativa de pagamento: o id é o da cobrança (pay_...) ou da assinatura (sub_...).
alter table public.checkout_sessions drop constraint if exists checkout_sessions_status_check;
alter table public.checkout_sessions add constraint checkout_sessions_status_check check (status in ('pending', 'paid', 'canceled', 'expired', 'failed'));
alter table public.checkout_sessions add column method text check (method in ('pix', 'boleto', 'card'));
alter table public.checkout_sessions add column kind text not null default 'checkout' check (kind in ('checkout', 'payment', 'subscription'));
alter table public.checkout_sessions add column info jsonb not null default '{}'::jsonb;   -- Pix (código e QR), boleto (linha e link), valor, vencimento
alter table public.checkout_sessions add column failure text;                                 -- motivo da recusa, em português
create index on public.checkout_sessions (user_id, created_at desc);

-- A pessoa na Asaas: um cadastro por conta, reaproveitado a cada tentativa (o CPF fica só na Asaas)
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261016000400', 'pagamento_proprio')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.billing_customers') is not null as tabela_clientes,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'checkout_sessions' and column_name in ('method', 'kind', 'info', 'failure')) as colunas;
