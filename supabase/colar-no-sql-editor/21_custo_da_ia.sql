-- Cabeça Leve, passo 21 de 22: custo da IA por usuário e modelo (tela /admin/custos).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez.
-- Deve terminar com uma linha de conferência: tabela_ai_usage = true, funcao = true, migracoes_no_historico = 10.

begin;

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  turn_id uuid not null,
  model text not null check (length(model) between 1 and 100),
  calls integer not null check (calls >= 1),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cache_read_tokens bigint not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create function public.admin_ai_usage(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, model text, turns bigint, calls bigint, input_tokens bigint, output_tokens bigint, cache_read_tokens bigint, cache_write_tokens bigint)
language sql stable security definer set search_path = public as $$
  select u.user_id, u.model, count(distinct u.turn_id), sum(u.calls)::bigint, sum(u.input_tokens)::bigint,
         sum(u.output_tokens)::bigint, sum(u.cache_read_tokens)::bigint, sum(u.cache_write_tokens)::bigint
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
  group by u.user_id, u.model
$$;
revoke execute on function public.admin_ai_usage(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_usage(timestamptz, timestamptz) to service_role;

-- Histórico igual ao de supabase/migrations (a Action do GitHub vê esta migração como já aplicada)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261009000100', 'custo_ia')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.ai_usage') is not null as tabela_ai_usage,
  exists (select 1 from pg_proc where proname = 'admin_ai_usage') as funcao,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
