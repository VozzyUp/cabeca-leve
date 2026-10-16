-- Peraí, passo 31 de 31: diagnóstico do sistema (último sinal do webhook do WhatsApp e da fila, visto em Administração).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 30.
-- (Se a Action de deploy já aplicou as migrações, não rode: a tabela já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: tabela = true, migracoes_no_historico = 20.

begin;

create table public.system_status (
  key text primary key check (length(key) between 1 and 60),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.system_status enable row level security;
revoke all on public.system_status from anon, authenticated;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261016000200', 'diagnostico')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.system_status') is not null as tabela,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
