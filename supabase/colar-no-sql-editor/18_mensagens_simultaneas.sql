-- Cabeça Leve, passo 18 de 21: mensagens_simultaneas.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

alter table public.conversations add column if not exists turn_lease_until timestamptz;

create or replace function public.append_message(
  p_user uuid, p_conversation uuid, p_role text, p_channel text, p_content jsonb, p_text_preview text,
  p_cards jsonb, p_visible boolean, p_client_message_id text, p_external_message_id text,
  p_model text, p_input_tokens integer, p_output_tokens integer, p_cache_read_tokens integer
) returns table (id uuid, created_at timestamptz)
language plpgsql security invoker set search_path = public as $$
declare
  v_seq integer;
begin
  perform 1 from conversations c where c.id = p_conversation and c.user_id = p_user for update;
  if not found then
    raise exception 'conversa não encontrada';
  end if;
  select coalesce(max(m.seq), -1) + 1 into v_seq from messages m where m.conversation_id = p_conversation;
  return query
    insert into messages (user_id, conversation_id, seq, role, channel, content, text_preview, cards, visible,
                          client_message_id, external_message_id, model, input_tokens, output_tokens, cache_read_tokens)
    values (p_user, p_conversation, v_seq, p_role, p_channel, p_content, p_text_preview, coalesce(p_cards, '[]'::jsonb),
            coalesce(p_visible, true), p_client_message_id, p_external_message_id, p_model, p_input_tokens, p_output_tokens,
            p_cache_read_tokens)
    returning messages.id, messages.created_at;
end $$;

create or replace function public.acquire_turn(p_user uuid, p_conversation uuid, p_seconds integer)
returns boolean
language sql security invoker set search_path = public as $$
  with got as (
    update conversations set turn_lease_until = now() + make_interval(secs => p_seconds)
    where id = p_conversation and user_id = p_user and (turn_lease_until is null or turn_lease_until < now())
    returning 1
  )
  select exists (select 1 from got);
$$;

create or replace function public.release_turn(p_user uuid, p_conversation uuid)
returns void
language sql security invoker set search_path = public as $$
  update conversations set turn_lease_until = null where id = p_conversation and user_id = p_user;
$$;

revoke execute on function public.append_message(uuid, uuid, text, text, jsonb, text, jsonb, boolean, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.acquire_turn(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_turn(uuid, uuid) from public, anon, authenticated;
grant execute on function public.append_message(uuid, uuid, text, text, jsonb, text, jsonb, boolean, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.acquire_turn(uuid, uuid, integer) to service_role;
grant execute on function public.release_turn(uuid, uuid) to service_role;

commit;
