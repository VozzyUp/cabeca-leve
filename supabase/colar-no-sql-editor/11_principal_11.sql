-- Cabeça Leve, passo 11 de 21: banco principal (tabelas alert_rules, alert_events, workout_plans, workout_plan_sessions, workout_plan_exercises).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bill_due', 'card_limit', 'income_committed', 'project_stalled',
                                     'habit_overdue', 'task_overdue', 'next_month_squeeze', 'day_complete')),
  enabled boolean not null default true,
  threshold numeric(10, 2),               
  channels text[] not null default '{push}'
    check (channels <@ array['push', 'whatsapp', 'telegram', 'email']::text[]
           and cardinality(channels) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind)
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid not null,
  dedupe_key text not null unique,        
  payload jsonb not null default '{}',
  fired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rule_id, user_id)
    references public.alert_rules (id, user_id) on delete cascade
);

create index on public.alert_events (user_id, fired_at desc);

create index on public.alert_events (rule_id);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  habit_id uuid,                          
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
  name text not null check (length(name) between 1 and 120),   
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

commit;
