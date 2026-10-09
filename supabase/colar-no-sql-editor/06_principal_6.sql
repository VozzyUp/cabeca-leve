-- Cabeça Leve, passo 6 de 21: banco principal (tabelas focus_sessions, habits, habit_logs).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

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

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  color text,
  goal_type text not null default 'check' check (goal_type in ('check', 'duration', 'count')),
  goal_target numeric(10, 2) check (goal_target is null or goal_target > 0),
  goal_unit text,                         
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}'
    check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(weekdays) > 0),
  times time[] not null default '{}',     
  overdue_nudge boolean not null default true,  
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (goal_type = 'check' or goal_target is not null)
);

create index on public.habits (user_id, active);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,                      
  value numeric(10, 2) not null default 1 check (value > 0),
  source text not null default 'manual'
    check (source in ('manual', 'chat', 'whatsapp', 'strava', 'apple_health', 'health_connect', 'watch')),
  off_plan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade,
  unique (habit_id, day)                  
);

create index on public.habit_logs (user_id, day);

commit;
