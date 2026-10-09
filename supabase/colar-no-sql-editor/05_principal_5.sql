-- Cabeça Leve, passo 5 de 20: banco principal (tabelas tasks, reminders, scheduled_deliveries).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  milestone_id uuid,
  parent_task_id uuid,
  title text not null check (length(title) between 1 and 300),
  notes text,
  due_on date,                            
  due_at timestamptz,                     
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position double precision not null default 0,  
  recurrence_rule text,                   
  recurrence_source_id uuid,              
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

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid,
  title text not null check (length(title) between 1 and 300),
  notes text,
  next_fire_at timestamptz,               
  recurrence_rule text,                   
  timezone text not null,
  lead_minutes integer[] not null default '{}',  
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
  queue_message_id text,                  
  dedupe_key text not null unique,        
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.scheduled_deliveries (status, send_at);

create index on public.scheduled_deliveries (user_id, send_at desc);

create index on public.scheduled_deliveries (source_type, source_id);

commit;
