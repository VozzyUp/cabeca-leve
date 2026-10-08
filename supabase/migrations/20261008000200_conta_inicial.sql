-- A conta criada no cadastro começa com saldo zero e conta TODOS os lançamentos: um gasto
-- de "ontem" contado no primeiro dia também precisa mexer no saldo.
create or replace function public.handle_new_user_extras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (user_id, name, opening_balance_on) values (new.id, 'Conta corrente', date '1900-01-01');
  update public.profiles set display_name = nullif(new.raw_user_meta_data ->> 'name', '') where user_id = new.id;
  insert into public.notices (user_id, kind, title, body, href)
  values (new.id, 'system', 'Bem-vindo', 'Conte o que precisa na conversa: tarefas, gastos, lembretes, hábitos.', '/conversa');
  return new;
end $$;

update public.accounts set opening_balance_on = date '1900-01-01'
where opening_balance_cents = 0 and name = 'Conta corrente';
