-- Cabeça Leve, passo 1 de 20: banco principal (tabelas profiles, subscriptions, billing_events, channel_links, push_subscriptions, conversations).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create extension if not exists vector;

create extension if not exists unaccent;

create text search configuration public.pt_unaccent (copy = pg_catalog.portuguese);

alter text search configuration public.pt_unaccent
  alter mapping for hword, hword_part, word with unaccent, portuguese_stem;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

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

create table public.channel_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'telegram')),
  external_id text not null,              
  verification_code_hash text,
  verification_expires_at timestamptz,
  verified_at timestamptz,
  last_inbound_at timestamptz,            
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);

create unique index channel_links_verified_unique
  on public.channel_links (channel, external_id) where verified_at is not null;

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

commit;
