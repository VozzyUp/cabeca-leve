-- Cabeça Leve, passo 17 de 22: checkout, exclusao_conta e realtime.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table if not exists public.checkout_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkout_sessions_user_id_idx on public.checkout_sessions (user_id);
alter table public.checkout_sessions enable row level security;
drop policy if exists checkout_sessions_select_own on public.checkout_sessions;
create policy checkout_sessions_select_own on public.checkout_sessions for select to authenticated using (user_id = (select auth.uid()));
drop trigger if exists checkout_sessions_set_updated_at on public.checkout_sessions;
create trigger checkout_sessions_set_updated_at before update on public.checkout_sessions for each row execute function public.set_updated_at();

create or replace function public.delete_embeddings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.embeddings
  where source_type = tg_argv[0] and source_id = old.id;
  return old;
end $$;
revoke all on function public.delete_embeddings() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks', 'reminders', 'transactions', 'habits', 'habit_logs', 'messages',
    'notices', 'notes', 'journal_entries', 'goals', 'goal_entries', 'projects', 'milestones',
    'recurrences', 'categories', 'food_logs', 'workout_logs', 'body_measurements',
    'focus_sessions', 'automations', 'channel_links', 'subscriptions', 'profiles'
  ] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
