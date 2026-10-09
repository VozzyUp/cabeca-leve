-- Cabeça Leve, passo 16 de 20: telas (avisos e cadastro) e conta_inicial.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'briefing', 'automation', 'bill', 'system')),
  title text not null check (length(title) between 1 and 120),
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notices_user_id_created_at_idx on public.notices (user_id, created_at desc);
alter table public.notices enable row level security;
drop policy if exists notices_select_own on public.notices;
create policy notices_select_own on public.notices for select to authenticated using (user_id = (select auth.uid()));
drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at before update on public.notices for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_extras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (user_id, name) values (new.id, 'Conta corrente');
  update public.profiles set display_name = nullif(new.raw_user_meta_data ->> 'name', '') where user_id = new.id;
  insert into public.notices (user_id, kind, title, body, href)
  values (new.id, 'system', 'Bem-vindo', 'Conte o que precisa na conversa: tarefas, gastos, lembretes, hábitos.', '/conversa');
  return new;
end $$;

drop trigger if exists on_auth_user_created_extras on auth.users;
create trigger on_auth_user_created_extras after insert on auth.users
  for each row execute function public.handle_new_user_extras();

-- conta_inicial: a conta nova conta TODOS os lançamentos desde 1900
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

commit;
