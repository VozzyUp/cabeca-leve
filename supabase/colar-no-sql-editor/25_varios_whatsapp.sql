-- Cabeça Leve, passo 25 de 25: vários WhatsApps na mesma conta.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 24.
-- (Se a Action de deploy já aplicou as migrações, este arquivo não muda nada.)
-- Deve terminar com uma linha de conferência: varios_numeros = true, quem_lancou = true, migracoes_no_historico = 14.

begin;

alter table public.channel_links drop constraint if exists channel_links_user_id_channel_key;
create unique index if not exists channel_links_user_number_unique on public.channel_links (user_id, channel, external_id);
alter table public.channel_links
  add column if not exists label text check (label is null or length(label) between 1 and 40),
  add column if not exists receives_notices boolean not null default true;
alter table public.transactions add column if not exists author text check (author is null or length(author) between 1 and 40);

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261010000300', 'varios_whatsapp')
  on conflict (version) do nothing;

commit;

select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'channel_links' and column_name = 'receives_notices')
    and not exists (select 1 from pg_constraint where conname = 'channel_links_user_id_channel_key') as varios_numeros,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'transactions' and column_name = 'author') as quem_lancou,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
