-- Cabeça Leve, passo 26 de 26: pesquisa diária na web e cofre de senhas.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 25.
-- (Se a Action de deploy já aplicou as migrações, não rode: a tabela do cofre já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: pesquisa_web = true, cofre = true, migracoes_no_historico = 15.

begin;

-- 1) Pesquisa diária na web: as revisões agendadas ganham a fonte 'web' (a IA busca na internet
--    sobre o assunto pedido) e o custo das buscas entra no painel de custos.
alter table public.automations drop constraint if exists automations_sources_check;
alter table public.automations add constraint automations_sources_check
  check (sources <@ array['tasks', 'projects', 'habits', 'goals', 'finance', 'calendar', 'notes', 'web']::text[] and cardinality(sources) > 0);

alter table public.ai_usage add column if not exists web_searches integer not null default 0 check (web_searches >= 0);

drop function if exists public.admin_ai_usage(timestamptz, timestamptz);
create function public.admin_ai_usage(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, model text, turns bigint, calls bigint, input_tokens bigint, output_tokens bigint, cache_read_tokens bigint, cache_write_tokens bigint, web_searches bigint)
language sql stable security definer set search_path = public as $$
  select u.user_id, u.model, count(distinct u.turn_id), sum(u.calls)::bigint, sum(u.input_tokens)::bigint,
         sum(u.output_tokens)::bigint, sum(u.cache_read_tokens)::bigint, sum(u.cache_write_tokens)::bigint, sum(u.web_searches)::bigint
  from public.ai_usage u
  where u.created_at >= p_from and u.created_at < p_to
  group by u.user_id, u.model
$$;
revoke execute on function public.admin_ai_usage(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_usage(timestamptz, timestamptz) to service_role;

-- 2) Cofre de senhas. Tudo é cifrado no aparelho com a senha mestra (AES-GCM, chave por PBKDF2):
--    aqui só ficam o sal, o número de rodadas, um verificador cifrado e os itens cifrados.
--    Nem o servidor, nem o time, nem a IA conseguem ler.
create table public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  salt text not null check (length(salt) between 16 and 64),
  iterations integer not null check (iterations between 100000 and 5000000),
  verifier_iv text not null check (length(verifier_iv) between 12 and 32),
  verifier text not null check (length(verifier) between 16 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.vaults (user_id) on delete cascade,
  iv text not null check (length(iv) between 12 and 32),
  ciphertext text not null check (length(ciphertext) between 16 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.vault_items (user_id);
-- só o servidor (rotas autenticadas com a chave secreta) mexe nessas tabelas
alter table public.vaults enable row level security;
alter table public.vault_items enable row level security;
revoke all on public.vaults, public.vault_items from anon, authenticated;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261014000100', 'pesquisa_e_cofre')
  on conflict (version) do nothing;

commit;

select
  pg_get_constraintdef((select oid from pg_constraint where conname = 'automations_sources_check')) like '%web%' as pesquisa_web,
  to_regclass('public.vault_items') is not null as cofre,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
