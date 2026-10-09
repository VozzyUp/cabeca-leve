-- Cabeça Leve, passo 22 de 22: fotos no chat (limpeza das fotos antigas).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 21.
-- Deve terminar com uma linha de conferência: funcao = true, indice = true, migracoes_no_historico = 11.

begin;

create or replace function public.forbid_message_edit() returns trigger
language plpgsql as $$
declare purging boolean := coalesce(current_setting('app.purge_images', true), '') = 'on';
begin
  if new.role is distinct from old.role
     or new.seq is distinct from old.seq
     or new.conversation_id is distinct from old.conversation_id
     or (new.content is distinct from old.content and not purging) then
    raise exception 'messages é somente-anexar: o histórico da conversa não pode ser editado';
  end if;
  return new;
end $$;

create index messages_with_image_idx on public.messages (created_at) where content @> '[{"type": "image"}]'::jsonb;

create function public.purge_old_message_images(p_days integer default 2)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('app.purge_images', 'on', true);
  update public.messages m set content = (
      select jsonb_agg(case when b ->> 'type' = 'image' then jsonb_build_object('type', 'text', 'text', '[foto removida]') else b end order by ord)
      from jsonb_array_elements(m.content) with ordinality as t(b, ord))
  where m.created_at < now() - make_interval(days => p_days)
    and m.content @> '[{"type": "image"}]'::jsonb;
  get diagnostics n = row_count;
  perform set_config('app.purge_images', 'off', true);
  return n;
end $$;
revoke execute on function public.purge_old_message_images(integer) from public, anon, authenticated;
grant execute on function public.purge_old_message_images(integer) to service_role;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261009000200', 'fotos')
  on conflict (version) do nothing;

commit;

select
  exists (select 1 from pg_proc where proname = 'purge_old_message_images') as funcao,
  to_regclass('public.messages_with_image_idx') is not null as indice,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
