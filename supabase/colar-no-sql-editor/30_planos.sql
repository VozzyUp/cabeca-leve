-- Peraí, passo 30 de 30: planos no banco (preço, duração e limites editáveis em Administração > Planos).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 29.
-- (Se a Action de deploy já aplicou as migrações, não rode: a tabela já existiria e dá erro.)
-- Deve terminar com uma linha de conferência: planos = 3, migracoes_no_historico = 19.

begin;

-- 1) Catálogo. kind 'trial' é o teste grátis (não se vende, não tem preço); 'paid' são os planos à venda.
--    Limite nulo = ainda vale o que estava em Configuração do sistema (LIMIT_*) ou o padrão: nada muda no dia do deploy.
--    months: quanto dura cada cobrança. recurring: true = cartão que renova sozinho; false = pagamento único (Pix ou cartão) que vale `months` meses.
create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  name text not null check (length(btrim(name)) between 1 and 40),
  tagline text check (tagline is null or length(tagline) <= 140),
  kind text not null default 'paid' check (kind in ('trial', 'paid')),
  price_cents integer not null default 0 check (price_cents between 0 and 10000000),
  months smallint not null default 1 check (months in (1, 3, 6, 12)),
  recurring boolean not null default true,
  whatsapp_limit smallint check (whatsapp_limit is null or whatsapp_limit between 1 and 20),
  messages_per_day integer check (messages_per_day is null or messages_per_day between 1 and 100000),
  storage_mb integer check (storage_mb is null or storage_mb between 1 and 1048576),
  featured boolean not null default false,
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'paid' or price_cents = 0),
  check (kind = 'trial' or price_cents > 0)
);
create unique index plans_one_trial_idx on public.plans (kind) where kind = 'trial';
alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;

insert into public.plans (id, name, tagline, kind, price_cents, months, recurring, featured, sort) values
  ('trial', 'Teste grátis', null, 'trial', 0, 1, false, false, 0),
  ('monthly', 'Mensal', null, 'paid', 3990, 1, true, false, 10),
  ('yearly', 'Anual', null, 'paid', 35900, 12, false, true, 20);

-- 2) Assinaturas e pagamentos em andamento passam a apontar para um plano do catálogo (que não some enquanto houver uso).
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_fk foreign key (plan) references public.plans (id) on update cascade on delete restrict;
alter table public.checkout_sessions drop constraint if exists checkout_sessions_plan_check;
alter table public.checkout_sessions add constraint checkout_sessions_plan_fk foreign key (plan) references public.plans (id) on update cascade on delete restrict;

-- 3) O registro do time também guarda mudanças que não são de uma conta (criar e editar planos).
alter table public.admin_actions alter column target_user_id drop not null;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261016000100', 'planos')
  on conflict (version) do nothing;

commit;

select
  (select count(*) from public.plans) as planos,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
