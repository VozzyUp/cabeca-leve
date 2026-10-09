-- Cabeça Leve, passo 20 de 20: histórico e conferência.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

-- Deixa o histórico igual ao dos arquivos de supabase/migrations: assim o "supabase db push"
-- (e a Action do GitHub) enxerga tudo como já aplicado e não tenta repetir nada.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
delete from supabase_migrations.schema_migrations;
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261008000000', 'init'),
  ('20261008000100', 'telas'),
  ('20261008000200', 'conta_inicial'),
  ('20261008000300', 'checkout'),
  ('20261008000400', 'exclusao_conta'),
  ('20261008000500', 'realtime'),
  ('20261008000600', 'mensagens_simultaneas'),
  ('20261008000700', 'confianca'),
  ('20261009000000', 'configuracao');

commit;

-- Conferência: tudo deve vir true, tabelas_publicas = 57, tabelas_no_realtime = 23, migracoes_no_historico = 9.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as tabelas_publicas,
  to_regclass('public.notices') is not null as notices,
  to_regclass('public.support_tickets') is not null as support_tickets,
  to_regclass('public.app_settings') is not null as app_settings,
  to_regclass('public.checkout_sessions') is not null as checkout_sessions,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'trial_ends_on') as perfil_com_teste,
  exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_extras') as cadastro_cria_conta,
  exists (select 1 from pg_proc where proname = 'append_message') as mensagens_simultaneas,
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') as tabelas_no_realtime,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
