-- Cabeça Leve, passo 23 de 23: configuração inicial para quem acabou de se cadastrar.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 22.
-- (Se a Action de deploy já aplicou as migrações, este arquivo não muda nada.)
-- Deve terminar com uma linha de conferência: coluna = true, migracoes_no_historico = 12.

begin;

alter table public.profiles add column if not exists onboarded_at timestamptz;
update public.profiles set onboarded_at = now() where onboarded_at is null;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261010000100', 'boas_vindas')
  on conflict (version) do nothing;

commit;

select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarded_at') as coluna,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
