-- Cabeça Leve, passo 24 de 24: tom "Sem filtro" do assistente.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 23.
-- (Se a Action de deploy já aplicou as migrações, este arquivo não muda nada.)
-- Deve terminar com uma linha de conferência: aceita_sem_filtro = true, migracoes_no_historico = 13.

begin;

alter table public.profiles drop constraint if exists profiles_assistant_tone_check;
alter table public.profiles add constraint profiles_assistant_tone_check
  check (assistant_tone in ('direct', 'warm', 'playful', 'tough', 'custom'));

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261010000200', 'tom_sem_filtro')
  on conflict (version) do nothing;

commit;

select
  pg_get_constraintdef((select oid from pg_constraint where conname = 'profiles_assistant_tone_check')) like '%tough%' as aceita_sem_filtro,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
