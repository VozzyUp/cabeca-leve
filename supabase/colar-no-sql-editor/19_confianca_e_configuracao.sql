-- Cabeça Leve, passo 19 de 21: confianca e configuracao.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

alter table public.subscriptions
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_protocol text;

alter table public.checkout_sessions add column if not exists returned_at timestamptz;

alter table public.notices drop constraint if exists notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('reminder', 'briefing', 'automation', 'bill', 'system', 'support', 'billing'));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  protocol text not null unique,
  channel text not null check (channel in ('web', 'whatsapp', 'voice')),
  message text not null check (length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  due_at timestamptz not null,
  reply text check (reply is null or length(reply) between 1 and 4000),
  answered_at timestamptz,
  answered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_id_created_at_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_due_at_idx on public.support_tickets (status, due_at);
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets for select to authenticated using (user_id = (select auth.uid()));
drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create table if not exists public.app_settings (
  key text primary key check (key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value_encrypted text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

commit;
