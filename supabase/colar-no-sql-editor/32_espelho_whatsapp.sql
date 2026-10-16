-- Peraí, passo 32 de 32: espelho no WhatsApp (chave em Configurar assistente, desligada por padrão).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 31.
-- (Se a Action de deploy já aplicou as migrações, não rode: a coluna já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: coluna = true, migracoes_no_historico = 21.

begin;

alter table public.profiles add column mirror_whatsapp boolean not null default false;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261016000300', 'espelho_whatsapp')
  on conflict (version) do nothing;

commit;

select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'mirror_whatsapp') as coluna,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
