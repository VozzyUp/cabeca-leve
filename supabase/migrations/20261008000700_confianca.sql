-- F1, F2 e F3 do replica/fixes.md: o que mais irrita quem usa o original
-- (cobrança depois de cancelar, "assinatura inválida" depois de pagar, suporte que não responde).

-- F1: quando cancelou, com protocolo; pagamento de período depois disso é estornado
alter table public.subscriptions
  add column canceled_at timestamptz,
  add column cancel_protocol text;

-- F2: a pessoa voltou da página de pagamento; libera o acesso por pouco tempo enquanto a Asaas confirma
alter table public.checkout_sessions add column returned_at timestamptz;

-- avisos: suporte e cobrança entram na lista de Avisos
alter table public.notices drop constraint notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('reminder', 'briefing', 'automation', 'bill', 'system', 'support', 'billing'));

-- F3: falar com uma pessoa. Protocolo curto para citar no WhatsApp ou no e-mail.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  protocol text not null unique,
  channel text not null check (channel in ('web', 'whatsapp', 'voice')),
  message text not null check (length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  due_at timestamptz not null,            -- prazo de resposta prometido
  reply text check (reply is null or length(reply) between 1 and 4000),
  answered_at timestamptz,
  answered_by text,                       -- e-mail de quem respondeu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (user_id, created_at desc);
create index on public.support_tickets (status, due_at);
alter table public.support_tickets enable row level security;
create policy support_tickets_select_own on public.support_tickets for select to authenticated using (user_id = (select auth.uid()));
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();
