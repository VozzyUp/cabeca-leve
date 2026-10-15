-- Peraí, passo 28 de 28: documentos pelo chat e pelo WhatsApp (anexos estacionados por 24 h e limpeza de PDF do histórico).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 27.
-- (Se a Action de deploy já aplicou as migrações, não rode: a tabela já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: estacionamento = true, limpeza_de_pdf = true, migracoes_no_historico = 17.

begin;

-- Documentos pelo chat e pelo WhatsApp.
-- 1) Arquivo recebido que ainda não foi para uma pasta fica "estacionado" por 24 horas: a pessoa manda a nota
--    sem dizer o que fazer, o assistente pergunta a pasta, e na resposta o arquivo original ainda está lá.
--    O arquivo fica no mesmo bucket privado, em <user_id>/staging/; passada 1 dia, a varredura apaga.
create table public.document_staging (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now()
);
create index document_staging_user_idx on public.document_staging (user_id, created_at);
create index document_staging_created_idx on public.document_staging (created_at);
alter table public.document_staging enable row level security;
revoke all on public.document_staging from anon, authenticated;

-- 2) PDF que a pessoa manda na conversa entra no histórico do dia (o assistente o enxerga nas mensagens seguintes)
--    e, como a foto, é trocado por um aviso de texto depois de alguns dias. O arquivo em si vai para Documentos.
create or replace function public.purge_old_message_images(p_days integer default 2)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('app.purge_images', 'on', true);
  update public.messages m set content = (
      select jsonb_agg(case b ->> 'type'
                         when 'image' then jsonb_build_object('type', 'text', 'text', '[foto removida]')
                         when 'document' then jsonb_build_object('type', 'text', 'text', '[documento removido]')
                         else b end order by ord)
      from jsonb_array_elements(m.content) with ordinality as t(b, ord))
  where m.created_at < now() - make_interval(days => p_days)
    and (m.content @> '[{"type": "image"}]'::jsonb or m.content @> '[{"type": "document"}]'::jsonb);
  get diagnostics n = row_count;
  perform set_config('app.purge_images', 'off', true);
  return n;
end $$;
revoke execute on function public.purge_old_message_images(integer) from public, anon, authenticated;
grant execute on function public.purge_old_message_images(integer) to service_role;

create index messages_with_document_idx on public.messages (created_at) where content @> '[{"type": "document"}]'::jsonb;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261015000200', 'documentos_no_chat')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.document_staging') is not null as estacionamento,
  pg_get_functiondef('public.purge_old_message_images(integer)'::regprocedure) like '%documento removido%' as limpeza_de_pdf,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
