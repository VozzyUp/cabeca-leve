-- Cabeça Leve, passo 12 de 20: banco principal (tabelas workout_logs, workout_sets, diet_plans, diet_meals, food_logs).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

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
  unique (source, external_id),           
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
  name text not null check (length(name) between 1 and 80),   
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

commit;
