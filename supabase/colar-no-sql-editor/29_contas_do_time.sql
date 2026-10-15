-- Peraí, passo 29 de 29: contas do time (lista de contas com plano e uso, e registro das ações do time).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 28.
-- (Se a Action de deploy já aplicou as migrações, não rode: a tabela já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: registro = true, funcao = true, migracoes_no_historico = 18.

begin;

-- Painel do time: lista de contas com plano e uso, e registro de tudo o que o time muda numa conta.

-- 1) Registro das ações do time (plano manual, teste, exclusão). Sem chave estrangeira no alvo: o registro
--    sobrevive à exclusão da conta, com o e-mail guardado no próprio registro.
create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_email text not null,
  target_user_id uuid not null,
  target_email text,
  action text not null check (length(action) between 1 and 60),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_target_idx on public.admin_actions (target_user_id, created_at desc);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;

-- 2) Uma linha por conta: cadastro, teste, assinatura que vale agora (mesma regra do app: ativa, em teste ou
--    em atraso, ou cancelada dentro do período pago) e o uso. Só a chave secreta do servidor chama.
create function public.admin_accounts()
returns table (
  user_id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, trial_ends_on date,
  sub_plan text, sub_status text, sub_end timestamptz, sub_ref text, sub_cancels boolean,
  whatsapps bigint, documents bigint, storage_bytes bigint, messages_30d bigint, last_message_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at, p.trial_ends_on,
         s.plan, s.status, s.current_period_end, s.provider_subscription_id, s.cancel_at_period_end,
         (select count(*) from public.channel_links c where c.user_id = u.id and c.channel = 'whatsapp' and c.verified_at is not null),
         (select count(*) from public.documents d where d.user_id = u.id),
         (select coalesce(sum(d.size_bytes), 0) from public.documents d where d.user_id = u.id),
         (select count(*) from public.messages m where m.user_id = u.id and m.role = 'user' and m.created_at > now() - interval '30 days'),
         (select max(m.created_at) from public.messages m where m.user_id = u.id and m.role = 'user')
  from auth.users u
  join public.profiles p on p.user_id = u.id
  left join lateral (
    select * from public.subscriptions s
    where s.user_id = u.id and (s.status in ('active', 'trialing', 'past_due') or s.current_period_end > now())
    order by s.created_at desc limit 1
  ) s on true
  order by u.created_at desc
$$;
revoke execute on function public.admin_accounts() from public, anon, authenticated;
grant execute on function public.admin_accounts() to service_role;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261015000300', 'admin_contas')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.admin_actions') is not null as registro,
  to_regprocedure('public.admin_accounts()') is not null as funcao,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
