-- Excluir a conta apaga mensagens, notas e diário em cascata, e cada exclusão dispara a
-- limpeza do índice de busca. A exclusão roda com o papel do Auth, que não tem acesso à
-- tabela embeddings: sem security definer, apagar qualquer conta com mensagens falhava.
create or replace function public.delete_embeddings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.embeddings
  where source_type = tg_argv[0] and source_id = old.id;
  return old;
end $$;
revoke all on function public.delete_embeddings() from public, anon, authenticated;
