-- Cabeça Leve, passo 10 de 20: banco principal (tabelas integration_secrets, calendars, calendar_events, automations, automation_runs).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

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

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  integration_id uuid not null,
  external_id text not null,
  name text not null,
  color text,
  selected boolean not null default true,
  sync_token text,                        
  watch_channel_id text,                  
  watch_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (integration_id, user_id)
    references public.integrations (id, user_id) on delete cascade,
  unique (integration_id, external_id)
);

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
  unique (automation_id, scheduled_for)  
);

create index on public.automation_runs (user_id, scheduled_for desc);

create index on public.automation_runs (message_id);

commit;
