-- =============================================================================
-- Esquema do banco: assistente pessoal com IA
-- Postgres 15+ no Supabase. Gerado pelo /replica-architect a partir de replica/recon.md.
--
-- Regras do esquema:
-- - toda tabela tem id uuid, created_at, updated_at e user_id (dono)
-- - FKs entre registros do mesmo usuário são compostas (id, user_id): é impossível
--   apontar para um registro de outro usuário, mesmo com bug no servidor
-- - dinheiro em centavos (bigint) + moeda; instantes em timestamptz (UTC);
--   dias de calendário (prazo sem hora, dia do hábito, mês da fatura) em date,
--   interpretados no fuso do usuário (profiles.timezone)
-- - status em texto com check constraint (não enum), para migrar sem dor
-- - RLS ligado em todas as tabelas. O navegador só LÊ as linhas do próprio
--   usuário (telas e Realtime). Toda ESCRITA passa pelo servidor, que usa a
--   service role e por isso filtra por user_id na camada de dados, sempre.
-- - Fases: [F1] núcleo, [F2] áreas completas, [F3] saúde. A ordem do arquivo
--   segue as dependências; o /replica-build quebra em migrações por fase.
-- =============================================================================

create extension if not exists vector;    -- pgvector, para a busca por sentido
create extension if not exists unaccent;  -- busca por texto sem depender de acento

-- Busca por texto em português que ignora acentos ("reuniao" acha "Reunião").
-- Limite conhecido: o radical do Postgres não junta alguns plurais ("viagens" x
-- "viagem"); a busca principal é a por sentido (tabela embeddings).
create text search configuration public.pt_unaccent (copy = pg_catalog.portuguese);
alter text search configuration public.pt_unaccent
  alter mapping for hword, hword_part, word with unaccent, portuguese_stem;

-- updated_at automático
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Conta, assinatura e canais
-- -----------------------------------------------------------------------------

-- [F1] Perfil e preferências (1-1 com auth.users)
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 80),
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  assistant_tone text not null default 'neutral'
    check (assistant_tone in ('neutral', 'calm', 'serious', 'upbeat', 'custom')),
  assistant_tone_custom text check (length(assistant_tone_custom) <= 500),
  assistant_voice text,
  briefing_enabled boolean not null default true,
  briefing_time time not null default '07:30',
  quiet_hours_start time,
  quiet_hours_end time,
  daily_alert_cap smallint not null default 5 check (daily_alert_cap between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assistant_tone <> 'custom' or assistant_tone_custom is not null),
  check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

-- [F1] Assinatura (escrita só pelo webhook de pagamento)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe', 'asaas')),
  provider_customer_id text not null,
  provider_subscription_id text not null unique,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  checkout_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.subscriptions (user_id);

-- [F1] Eventos de pagamento recebidos (idempotência: o provedor reenvia)
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null,
  event_id text not null,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);
create index on public.billing_events (user_id);

-- [F1] Canais de conversa vinculados (WhatsApp; Telegram na F3)
create table public.channel_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'telegram')),
  external_id text not null,              -- WhatsApp: número E.164; Telegram: chat id
  verification_code_hash text,
  verification_expires_at timestamptz,
  verified_at timestamptz,
  last_inbound_at timestamptz,            -- abre a janela de 24 h de atendimento da Meta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);
-- um número só pode estar verificado em uma conta; tentativas sem verificar não bloqueiam ninguém
create unique index channel_links_verified_unique
  on public.channel_links (channel, external_id) where verified_at is not null;

-- [F1] Inscrições de Web Push (um registro por navegador/aparelho)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- Conversa com o assistente
-- -----------------------------------------------------------------------------

-- [F1] Uma conversa por usuário por dia local (o histórico na tela atravessa os dias)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  compacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, local_date)
);

-- [F1] Mensagens: somente-anexar. O conteúdo é o bloco da API como foi enviado/recebido,
-- reenviado byte a byte nas próximas chamadas (exigência do "preserved thinking").
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  seq integer not null check (seq >= 0),
  role text not null check (role in ('user', 'assistant', 'system')),
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'voice', 'job')),
  content jsonb not null,
  text_preview text,
  client_message_id text,                 -- idempotência do envio pelo app (duplo clique)
  external_message_id text,               -- id da mensagem no WhatsApp/Telegram (webhook repetido)
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade,
  unique (conversation_id, seq),
  unique (user_id, client_message_id),
  unique (channel, external_message_id)
);
create index on public.messages (conversation_id);
create index on public.messages (user_id, created_at desc);

create or replace function public.forbid_message_edit() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content
     or new.role is distinct from old.role
     or new.seq is distinct from old.seq
     or new.conversation_id is distinct from old.conversation_id then
    raise exception 'messages é somente-anexar: o histórico da conversa não pode ser editado';
  end if;
  return new;
end $$;
create trigger messages_append_only before update on public.messages
  for each row execute function public.forbid_message_edit();

-- [F1] Anexos (áudio, foto, documento) guardados no Storage
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid,
  kind text not null check (kind in ('audio', 'image', 'document')),
  storage_path text not null unique,      -- <user_id>/<id>.<ext> no bucket privado
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),  -- 25 MB
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  transcript text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete cascade
);
create index on public.attachments (message_id);
create index on public.attachments (user_id, created_at desc);

-- [F1] Registro de ações do assistente (base do "desfazer")
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid,                        -- resposta do assistente que fez a ação
  tool_name text not null,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete set null (message_id),
  check (operation = 'create' or before is not null),
  check (operation = 'delete' or after is not null)
);
create index on public.actions (message_id);
create index on public.actions (user_id, created_at desc);
create index on public.actions (entity_table, entity_id);

-- [F2] Memória: fatos e preferências que o assistente guarda sobre o usuário
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fact text not null check (length(fact) between 1 and 500),
  source_message_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_message_id, user_id)
    references public.messages (id, user_id) on delete set null (source_message_id)
);
create index on public.memories (user_id) where archived_at is null;
create index on public.memories (source_message_id);

-- -----------------------------------------------------------------------------
-- Finanças: categorias, contas e cartões (vêm antes de projetos e tarefas)
-- -----------------------------------------------------------------------------

-- [F1] Categorias e subcategorias (criadas no cadastro, editáveis)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(name) between 1 and 60),
  kind text not null check (kind in ('expense', 'income')),
  color text,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  unique nulls not distinct (user_id, parent_id, name)
);
create index on public.categories (parent_id);

-- [F1] Contas (banco, carteira, dinheiro). O saldo é calculado (view account_balances),
-- nunca guardado: dois lançamentos ao mesmo tempo não corrompem o saldo.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  institution text,
  kind text not null default 'checking'
    check (kind in ('checking', 'savings', 'cash', 'investment', 'wallet')),
  currency char(3) not null default 'BRL',
  opening_balance_cents bigint not null default 0,
  opening_balance_on date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index on public.accounts (user_id);

-- [F2] Cartões de crédito
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  institution text,
  limit_cents bigint not null check (limit_cents >= 0),
  currency char(3) not null default 'BRL',
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid,                -- conta que paga a fatura
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (payment_account_id, user_id)
    references public.accounts (id, user_id) on delete set null (payment_account_id)
);
create index on public.cards (user_id);
create index on public.cards (payment_account_id);

-- [F2] Faturas. O total é calculado a partir das compras (view card_invoice_totals).
create table public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  closes_on date not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete cascade,
  unique (card_id, reference_month),
  check (due_on >= closes_on),
  check ((status = 'paid') = (paid_at is not null))
);
create index on public.card_invoices (user_id, due_on);

-- [F2] Compras parceladas (geram um lançamento por parcela)
create table public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid,
  account_id uuid,
  category_id uuid,
  description text not null check (length(description) between 1 and 200),
  total_cents bigint not null check (total_cents > 0),
  currency char(3) not null default 'BRL',
  installments_count smallint not null check (installments_count between 2 and 72),
  first_due_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  check (num_nonnulls(card_id, account_id) = 1)
);
create index on public.installment_purchases (user_id);
create index on public.installment_purchases (card_id);
create index on public.installment_purchases (account_id);
create index on public.installment_purchases (category_id);

-- [F2] Recorrências: assinaturas, contas fixas e entradas fixas (geram lançamentos previstos)
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('subscription', 'bill', 'income')),
  description text not null check (length(description) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  category_id uuid,
  account_id uuid,
  card_id uuid,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  interval_count smallint not null default 1 check (interval_count between 1 and 12),
  anchor_on date not null,                -- primeira ocorrência; define o dia
  ends_on date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete set null (card_id),
  check (num_nonnulls(card_id, account_id) <= 1),
  check (ends_on is null or ends_on >= anchor_on)
);
create index on public.recurrences (user_id);
create index on public.recurrences (category_id);
create index on public.recurrences (account_id);
create index on public.recurrences (card_id);

-- -----------------------------------------------------------------------------
-- Projetos, tarefas e lembretes
-- -----------------------------------------------------------------------------

-- [F2] Modelos de projeto
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  definition jsonb not null default '{}',  -- etapas e tarefas padrão
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index on public.project_templates (user_id);

-- [F2] Projetos
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  starts_on date,
  due_on date,
  budget_cents bigint check (budget_cents is null or budget_cents >= 0),
  currency char(3) not null default 'BRL',
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (template_id, user_id)
    references public.project_templates (id, user_id) on delete set null (template_id),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);
create index on public.projects (user_id, status);
create index on public.projects (template_id);

-- [F2] Marcos (etapas) do projeto
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  due_on date,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade
);
create index on public.milestones (project_id, position);

-- [F1] Tarefas (subtarefas via parent_task_id; recorrência em RRULE)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  milestone_id uuid,
  parent_task_id uuid,
  title text not null check (length(title) between 1 and 300),
  notes text,
  due_on date,                            -- dia do prazo (fuso do usuário)
  due_at timestamptz,                     -- quando o prazo tem hora
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position double precision not null default 0,  -- ordem no quadro
  recurrence_rule text,                   -- RFC 5545, ex.: FREQ=WEEKLY;BYDAY=MO
  recurrence_source_id uuid,              -- tarefa recorrente que gerou esta ocorrência
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id),
  foreign key (milestone_id, user_id)
    references public.milestones (id, user_id) on delete set null (milestone_id),
  foreign key (parent_task_id, user_id)
    references public.tasks (id, user_id) on delete cascade,
  foreign key (recurrence_source_id, user_id)
    references public.tasks (id, user_id) on delete set null (recurrence_source_id),
  check ((status = 'done') = (completed_at is not null)),
  check (due_at is null or due_on is not null),
  check (parent_task_id is null or parent_task_id <> id)
);
create index on public.tasks (user_id, status, due_on);
create index on public.tasks (project_id);
create index on public.tasks (milestone_id);
create index on public.tasks (parent_task_id);
create index on public.tasks (recurrence_source_id);

-- [F1] Lembretes
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid,
  title text not null check (length(title) between 1 and 300),
  notes text,
  next_fire_at timestamptz,               -- próxima ocorrência
  recurrence_rule text,                   -- RFC 5545, calculada no fuso abaixo
  timezone text not null,
  lead_minutes integer[] not null default '{}',  -- avisos antes, ex.: {1440,60}
  important boolean not null default false,
  channels text[] not null default '{push}'
    check (channels <@ array['push', 'whatsapp', 'telegram', 'email']::text[]
           and cardinality(channels) > 0),
  status text not null default 'active' check (status in ('active', 'done', 'canceled')),
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete set null (task_id),
  check (status <> 'active' or next_fire_at is not null)
);
create index on public.reminders (user_id, status, next_fire_at);
create index on public.reminders (task_id);

-- [F1] Fila de entregas (lembretes, revisões, avisos, briefing). dedupe_key impede
-- entrega dupla quando a fila reenvia (entrega "pelo menos uma vez").
create table public.scheduled_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null
    check (source_type in ('reminder', 'automation', 'alert', 'briefing', 'link_code')),
  source_id uuid,
  channel text not null check (channel in ('push', 'whatsapp', 'telegram', 'email', 'chat')),
  send_at timestamptz not null,
  payload jsonb not null default '{}',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'failed', 'canceled', 'skipped')),
  attempts smallint not null default 0,
  queue_message_id text,                  -- id na fila (para cancelar)
  dedupe_key text not null unique,        -- ex.: reminder:<id>:<ocorrência>:<canal>
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.scheduled_deliveries (status, send_at);
create index on public.scheduled_deliveries (user_id, send_at desc);
create index on public.scheduled_deliveries (source_type, source_id);

-- [F2] Sessões de foco
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_minutes smallint check (planned_minutes between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete set null (task_id),
  check (ended_at is null or ended_at >= started_at)
);
create index on public.focus_sessions (user_id, started_at desc);
create index on public.focus_sessions (task_id);

-- -----------------------------------------------------------------------------
-- Hábitos
-- -----------------------------------------------------------------------------

-- [F1] Hábitos
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  color text,
  goal_type text not null default 'check' check (goal_type in ('check', 'duration', 'count')),
  goal_target numeric(10, 2) check (goal_target is null or goal_target > 0),
  goal_unit text,                         -- 'min', 'páginas', 'copos'...
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}'
    check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(weekdays) > 0),
  times time[] not null default '{}',     -- horários planejados
  overdue_nudge boolean not null default true,  -- cobrar quando passar do horário
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (goal_type = 'check' or goal_target is not null)
);
create index on public.habits (user_id, active);

-- [F1] Registros de hábito. Sequência e recorde são calculados a partir daqui.
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,                      -- dia local do registro
  value numeric(10, 2) not null default 1 check (value > 0),
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'whatsapp', 'strava', 'apple_health', 'health_connect', 'watch')),
  off_plan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade,
  unique (habit_id, day)                  -- dois aparelhos marcando juntos não duplicam
);
create index on public.habit_logs (user_id, day);

-- -----------------------------------------------------------------------------
-- Lançamentos financeiros
-- -----------------------------------------------------------------------------

-- [F1] Lançamentos. amount_cents é sempre positivo e o tipo dá a direção
-- (ajuste é a exceção: pode ser negativo). Compra no crédito tem card_id e não
-- mexe na conta: entra na fatura, que é paga por um lançamento card_payment.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type in ('expense', 'income', 'transfer', 'adjustment', 'card_payment')),
  status text not null default 'posted' check (status in ('posted', 'planned', 'skipped')),
  amount_cents bigint not null,
  currency char(3) not null default 'BRL',
  occurred_on date not null,              -- dia do lançamento, ou vencimento se previsto
  description text not null check (length(description) between 1 and 200),
  merchant text,
  category_id uuid,
  account_id uuid,
  card_id uuid,
  invoice_id uuid,                        -- fatura da compra, ou fatura quitada (card_payment)
  counterpart_account_id uuid,            -- destino de uma transferência
  project_id uuid,                        -- gasto que conta no orçamento de um projeto
  payment_method text
    check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other')),
  installment_purchase_id uuid,
  installment_number smallint,
  recurrence_id uuid,
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'whatsapp', 'import', 'recurrence', 'installment')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id),
  foreign key (invoice_id, user_id)
    references public.card_invoices (id, user_id) on delete set null (invoice_id),
  foreign key (counterpart_account_id, user_id) references public.accounts (id, user_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id),
  foreign key (installment_purchase_id, user_id)
    references public.installment_purchases (id, user_id) on delete cascade,
  foreign key (recurrence_id, user_id)
    references public.recurrences (id, user_id) on delete set null (recurrence_id),
  check (case when type = 'adjustment' then amount_cents <> 0 else amount_cents > 0 end),
  check (card_id is null or account_id is null),
  check (type <> 'transfer' or (account_id is not null and counterpart_account_id is not null
                                and account_id <> counterpart_account_id)),
  check (type = 'transfer' or counterpart_account_id is null),
  check (type <> 'card_payment' or (account_id is not null and invoice_id is not null)),
  check ((installment_purchase_id is null) = (installment_number is null)),
  unique (installment_purchase_id, installment_number),
  unique (recurrence_id, occurred_on)     -- gerar previstos de novo não duplica
);
create index on public.transactions (user_id, occurred_on desc);
create index on public.transactions (user_id, status, occurred_on);
create index on public.transactions (category_id);
create index on public.transactions (account_id);
create index on public.transactions (card_id);
create index on public.transactions (invoice_id);
create index on public.transactions (counterpart_account_id);
create index on public.transactions (project_id);
create index on public.transactions (installment_purchase_id);
create index on public.transactions (recurrence_id);

-- [F3] Teto de gasto por categoria
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  period text not null default 'monthly' check (period in ('monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  unique (category_id, period)
);

-- [F3] Importação de fatura/comprovante por foto: itens lidos aguardando confirmação
create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attachment_id uuid not null,
  card_id uuid,
  account_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'confirmed', 'failed', 'discarded')),
  items jsonb not null default '[]',      -- compras lidas, marcando as já lançadas
  confirmed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (attachment_id, user_id)
    references public.attachments (id, user_id) on delete cascade,
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete set null (card_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id)
);
create index on public.statement_imports (user_id, created_at desc);
create index on public.statement_imports (attachment_id);
create index on public.statement_imports (card_id);
create index on public.statement_imports (account_id);

-- -----------------------------------------------------------------------------
-- Metas
-- -----------------------------------------------------------------------------

-- [F2] Metas. Ligadas a uma conta, hábito ou projeto, avançam sozinhas.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('financial', 'habit', 'project', 'custom')),
  target_value numeric(14, 2) not null check (target_value > 0),
  unit text,                              -- 'BRL', 'treinos', '%'...
  deadline date,
  monthly_plan numeric(14, 2),            -- aporte ou ritmo planejado por mês
  account_id uuid,
  habit_id uuid,
  project_id uuid,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete set null (habit_id),
  foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete set null (project_id),
  check (num_nonnulls(account_id, habit_id, project_id) <= 1)
);
create index on public.goals (user_id, status);
create index on public.goals (account_id);
create index on public.goals (habit_id);
create index on public.goals (project_id);

-- [F2] Avanços manuais de metas (metas "custom" ou ajustes)
create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  value numeric(14, 2) not null,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);
create index on public.goal_entries (goal_id, occurred_on);

-- -----------------------------------------------------------------------------
-- Conhecimento
-- -----------------------------------------------------------------------------

-- [F2] Áreas e cadernos (área = caderno sem pai)
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(name) between 1 and 80),
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references public.notebooks (id, user_id) on delete cascade,
  unique nulls not distinct (user_id, parent_id, name)
);
create index on public.notebooks (parent_id);

-- [F2] Notas
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid,
  title text not null default '' check (length(title) <= 200),
  content text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'voice', 'whatsapp', 'web_research')),
  in_inbox boolean not null default false,  -- caixa de entrada: revisar depois
  pinned boolean not null default false,
  archived_at timestamptz,
  search tsvector generated always as
    (to_tsvector('public.pt_unaccent', coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (notebook_id, user_id)
    references public.notebooks (id, user_id) on delete set null (notebook_id),
  check (length(title) > 0 or length(content) > 0)
);
create index on public.notes (user_id, updated_at desc);
create index on public.notes (notebook_id);
create index on public.notes using gin (search);

-- [F3] Conexões entre notas (o "mapa")
create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_note_id uuid not null,
  to_note_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (from_note_id, user_id) references public.notes (id, user_id) on delete cascade,
  foreign key (to_note_id, user_id) references public.notes (id, user_id) on delete cascade,
  unique (from_note_id, to_note_id),
  check (from_note_id <> to_note_id)
);
create index on public.note_links (to_note_id);

-- [F2] Diário
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_on date not null,
  content text not null check (length(content) > 0),
  search tsvector generated always as (to_tsvector('public.pt_unaccent', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.journal_entries (user_id, entry_on desc);
create index on public.journal_entries using gin (search);

-- [F2] Índice de busca por sentido (servidor apenas). A dimensão do vetor
-- depende do modelo de embeddings escolhido no /replica-backend.
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('note', 'journal', 'message')),
  source_id uuid not null,
  chunk_index smallint not null default 0,
  content text not null,
  embedding vector(1024) not null,
  model text not null,                    -- trocar de modelo exige reindexar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index, model)
);
create index on public.embeddings (user_id, source_type);
create index on public.embeddings using hnsw (embedding vector_cosine_ops);

-- origem apagada => vetores apagados (a origem é polimórfica, então não há FK)
create or replace function public.delete_embeddings() returns trigger
language plpgsql as $$
begin
  delete from public.embeddings
  where source_type = tg_argv[0] and source_id = old.id;
  return old;
end $$;
create trigger notes_delete_embeddings after delete on public.notes
  for each row execute function public.delete_embeddings('note');
create trigger journal_delete_embeddings after delete on public.journal_entries
  for each row execute function public.delete_embeddings('journal');
create trigger messages_delete_embeddings after delete on public.messages
  for each row execute function public.delete_embeddings('message');

-- -----------------------------------------------------------------------------
-- Integrações e agenda
-- -----------------------------------------------------------------------------

-- [F2] Integrações OAuth (Google, Microsoft; Strava na F3). Tokens ficam em outra tabela.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'strava')),
  account_email text,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique nulls not distinct (user_id, provider, account_email)
);

-- [F2] Segredos das integrações: cifrados na aplicação (AES-GCM, chave fora do banco).
-- RLS ligado e SEM política: só o servidor lê.
create table public.integration_secrets (
  integration_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (integration_id, user_id)
    references public.integrations (id, user_id) on delete cascade
);

-- [F2] Calendários de cada integração
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  integration_id uuid not null,
  external_id text not null,
  name text not null,
  color text,
  selected boolean not null default true,
  sync_token text,                        -- sincronização incremental
  watch_channel_id text,                  -- inscrição de push do provedor
  watch_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (integration_id, user_id)
    references public.integrations (id, user_id) on delete cascade,
  unique (integration_id, external_id)
);

-- [F2] Eventos em cache (a fonte da verdade é o Google/Outlook)
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null,
  external_id text not null,
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  attendees jsonb not null default '[]',
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  etag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (calendar_id, user_id)
    references public.calendars (id, user_id) on delete cascade,
  unique (calendar_id, external_id),
  check (ends_at >= starts_at)
);
create index on public.calendar_events (user_id, starts_at);

-- -----------------------------------------------------------------------------
-- Automações e avisos proativos
-- -----------------------------------------------------------------------------

-- [F2] Revisões agendadas
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  instruction text not null check (length(instruction) between 1 and 2000),
  sources text[] not null
    check (sources <@ array['tasks', 'projects', 'habits', 'goals', 'finance', 'calendar', 'notes']::text[]
           and cardinality(sources) > 0),
  schedule text not null check (schedule in ('daily', 'weekly', 'once')),
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  run_time time not null,
  run_on date,
  timezone text not null,
  lookback_days smallint not null default 7 check (lookback_days between 1 and 90),
  push boolean not null default true,
  active boolean not null default true,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (schedule <> 'weekly' or cardinality(weekdays) > 0),
  check (schedule <> 'once' or run_on is not null)
);
create index on public.automations (user_id);
create index on public.automations (active, next_run_at);

-- [F2] Execuções das revisões
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  automation_id uuid not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'empty', 'failed', 'skipped')),
  message_id uuid,
  read_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (automation_id, user_id)
    references public.automations (id, user_id) on delete cascade,
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete set null (message_id),
  unique (automation_id, scheduled_for)  -- a fila entrega pelo menos uma vez: roda uma vez só
);
create index on public.automation_runs (user_id, scheduled_for desc);
create index on public.automation_runs (message_id);

-- [F2] Regras de aviso proativo (criadas no cadastro com valores padrão)
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bill_due', 'card_limit', 'income_committed', 'project_stalled',
                                     'habit_overdue', 'task_overdue', 'next_month_squeeze', 'day_complete')),
  enabled boolean not null default true,
  threshold numeric(10, 2),               -- ex.: 0.90 do limite, 0.70 da renda, 21 dias
  channels text[] not null default '{push}'
    check (channels <@ array['push', 'whatsapp', 'telegram', 'email']::text[]
           and cardinality(channels) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind)
);

-- [F2] Avisos disparados (dedupe_key evita mandar o mesmo aviso duas vezes)
create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid not null,
  dedupe_key text not null unique,        -- ex.: card_limit:<cartão>:<mês>:90
  payload jsonb not null default '{}',
  fired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rule_id, user_id)
    references public.alert_rules (id, user_id) on delete cascade
);
create index on public.alert_events (user_id, fired_at desc);
create index on public.alert_events (rule_id);

-- -----------------------------------------------------------------------------
-- Saúde [F3]
-- -----------------------------------------------------------------------------

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  habit_id uuid,                          -- o treino do dia nasce desta ficha
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete set null (habit_id)
);
create index on public.workout_plans (user_id);
create index on public.workout_plans (habit_id);

create table public.workout_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null,
  name text not null check (length(name) between 1 and 120),   -- ex.: "Costas + bíceps"
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  notes text,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id)
    references public.workout_plans (id, user_id) on delete cascade
);
create index on public.workout_plan_sessions (plan_id);

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_session_id uuid not null,
  exercise_name text not null check (length(exercise_name) between 1 and 120),
  target_sets smallint check (target_sets between 1 and 20),
  target_reps smallint check (target_reps between 1 and 100),
  target_load_kg numeric(6, 2) check (target_load_kg is null or target_load_kg >= 0),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_session_id, user_id)
    references public.workout_plan_sessions (id, user_id) on delete cascade
);
create index on public.workout_plan_exercises (plan_session_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_session_id uuid,
  habit_id uuid,
  kind text not null default 'strength'
    check (kind in ('strength', 'run', 'walk', 'ride', 'swim', 'other')),
  started_at timestamptz not null,
  finished_at timestamptz,
  distance_m integer check (distance_m is null or distance_m >= 0),
  duration_s integer check (duration_s is null or duration_s >= 0),
  calories integer check (calories is null or calories >= 0),
  source text not null default 'manual'
    check (source in ('manual', 'strava', 'apple_health', 'health_connect')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_session_id, user_id)
    references public.workout_plan_sessions (id, user_id) on delete set null (plan_session_id),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete set null (habit_id),
  unique (source, external_id),           -- o mesmo treino importado duas vezes não duplica
  check (finished_at is null or finished_at >= started_at)
);
create index on public.workout_logs (user_id, started_at desc);
create index on public.workout_logs (plan_session_id);
create index on public.workout_logs (habit_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_log_id uuid not null,
  exercise_name text not null,
  set_number smallint not null check (set_number between 1 and 50),
  load_kg numeric(6, 2) check (load_kg is null or load_kg >= 0),
  reps smallint check (reps is null or reps between 0 and 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workout_log_id, user_id)
    references public.workout_logs (id, user_id) on delete cascade,
  unique (workout_log_id, exercise_name, set_number)
);
-- histórico e recorde por exercício
create index on public.workout_sets (user_id, exercise_name, completed_at desc);

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  kcal_training integer check (kcal_training > 0),
  kcal_rest integer check (kcal_rest > 0),
  protein_g integer check (protein_g >= 0),
  carbs_g integer check (carbs_g >= 0),
  fat_g integer check (fat_g >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index on public.diet_plans (user_id);

create table public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  diet_plan_id uuid not null,
  name text not null check (length(name) between 1 and 80),   -- ex.: "Café da manhã"
  at_time time,
  items text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (diet_plan_id, user_id)
    references public.diet_plans (id, user_id) on delete cascade
);
create index on public.diet_meals (diet_plan_id);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  meal_name text,
  items text not null check (length(items) > 0),
  kcal integer check (kcal is null or kcal >= 0),
  protein_g numeric(6, 1),
  carbs_g numeric(6, 1),
  fat_g numeric(6, 1),
  source text not null default 'chat' check (source in ('chat', 'whatsapp', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.food_logs (user_id, logged_on desc);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weight', 'body_fat', 'waist', 'chest', 'arm', 'thigh', 'hip')),
  value numeric(7, 2) not null check (value > 0),
  unit text not null check (unit in ('kg', '%', 'cm')),
  measured_at timestamptz not null,
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'apple_health', 'health_connect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'weight' and unit = 'kg') or (kind = 'body_fat' and unit = '%')
         or (kind not in ('weight', 'body_fat') and unit = 'cm'))
);
create index on public.body_measurements (user_id, kind, measured_at desc);

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('steps', 'distance', 'active_calories', 'sleep', 'heart_rate')),
  value numeric(12, 2) not null,
  unit text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null check (source in ('apple_health', 'health_connect', 'strava')),
  external_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  check (ends_at >= starts_at)
);
create index on public.health_samples (user_id, kind, starts_at desc);

-- -----------------------------------------------------------------------------
-- Views calculadas (security_invoker: respeitam o RLS de quem consulta)
-- -----------------------------------------------------------------------------

-- Saldo de cada conta: saldo inicial + lançamentos realizados desde a data inicial
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.opening_balance_cents + coalesce(sum(
    case
      when t.account_id = a.id and t.type in ('income', 'adjustment') then t.amount_cents
      when t.account_id = a.id and t.type in ('expense', 'card_payment', 'transfer') then -t.amount_cents
      when t.counterpart_account_id = a.id and t.type = 'transfer' then t.amount_cents
      else 0
    end), 0) as balance_cents
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
 and (t.account_id = a.id or t.counterpart_account_id = a.id)
 and t.status = 'posted'
 and t.occurred_on >= a.opening_balance_on
group by a.id, a.user_id, a.opening_balance_cents;

-- Total de cada fatura (compras no crédito que caíram nela)
create view public.card_invoice_totals with (security_invoker = true) as
select
  i.id as invoice_id,
  i.user_id,
  i.card_id,
  coalesce(sum(t.amount_cents) filter (where t.type = 'expense' and t.status <> 'skipped'), 0)
    as total_cents
from public.card_invoices i
left join public.transactions t on t.invoice_id = i.id and t.user_id = i.user_id
group by i.id, i.user_id, i.card_id;

-- -----------------------------------------------------------------------------
-- Cadastro: perfil, categorias e regras de aviso padrão
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);

  insert into public.categories (user_id, name, kind)
  select new.id, c.name, c.kind
  from (values
    ('Alimentação', 'expense'), ('Mercado', 'expense'), ('Transporte', 'expense'),
    ('Moradia', 'expense'), ('Contas da casa', 'expense'), ('Saúde', 'expense'),
    ('Educação', 'expense'), ('Lazer', 'expense'), ('Compras', 'expense'),
    ('Assinaturas', 'expense'), ('Outros gastos', 'expense'),
    ('Salário', 'income'), ('Freelance', 'income'), ('Outras entradas', 'income')
  ) as c (name, kind);

  insert into public.alert_rules (user_id, kind, threshold)
  values
    (new.id, 'bill_due', 2),               -- dias antes do vencimento
    (new.id, 'card_limit', 0.90),
    (new.id, 'income_committed', 0.70),
    (new.id, 'project_stalled', 21),       -- dias sem movimento
    (new.id, 'habit_overdue', 60),         -- minutos depois do horário
    (new.id, 'task_overdue', 30),
    (new.id, 'next_month_squeeze', 0.80),
    (new.id, 'day_complete', null);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS e updated_at em todas as tabelas
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
  -- tabelas que o navegador pode LER (só as próprias linhas)
  readable text[] := array[
    'profiles', 'subscriptions', 'channel_links', 'push_subscriptions',
    'conversations', 'messages', 'attachments', 'actions', 'memories',
    'categories', 'accounts', 'cards', 'card_invoices', 'installment_purchases', 'recurrences',
    'project_templates', 'projects', 'milestones', 'tasks', 'reminders', 'scheduled_deliveries',
    'focus_sessions', 'habits', 'habit_logs', 'transactions', 'budgets', 'statement_imports',
    'goals', 'goal_entries', 'notebooks', 'notes', 'note_links', 'journal_entries',
    'integrations', 'calendars', 'calendar_events', 'automations', 'automation_runs',
    'alert_rules', 'alert_events',
    'workout_plans', 'workout_plan_sessions', 'workout_plan_exercises', 'workout_logs',
    'workout_sets', 'diet_plans', 'diet_meals', 'food_logs', 'body_measurements', 'health_samples'
  ];
  -- tabelas só do servidor (RLS ligado, nenhuma política)
  server_only text[] := array['billing_events', 'integration_secrets', 'embeddings'];
begin
  foreach t in array readable || server_only loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
  foreach t in array readable loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
  end loop;
end $$;
