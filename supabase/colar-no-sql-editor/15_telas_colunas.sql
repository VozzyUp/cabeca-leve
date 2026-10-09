-- Cabeça Leve, passo 15 de 21: telas (colunas novas).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

alter table public.profiles drop constraint if exists profiles_check;
alter table public.profiles drop constraint if exists profiles_assistant_tone_check;
alter table public.profiles drop constraint if exists profiles_tone_custom_check;
update public.profiles set assistant_tone = 'warm' where assistant_tone not in ('direct', 'warm', 'playful', 'custom');
alter table public.profiles
  alter column assistant_tone set default 'warm',
  add constraint profiles_assistant_tone_check
    check (assistant_tone in ('direct', 'warm', 'playful', 'custom')),
  add constraint profiles_tone_custom_check
    check (assistant_tone <> 'custom' or assistant_tone_custom is not null),
  add column if not exists answer_length text not null default 'short' check (answer_length in ('short', 'detailed')),
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists notify_push boolean not null default true,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_telegram boolean not null default false,
  add column if not exists trial_ends_on date not null default (current_date + 7);
alter table public.profiles alter column assistant_voice set default 'female';
update public.profiles set assistant_voice = 'female' where assistant_voice is null;
alter table public.profiles alter column briefing_time set default '07:00';

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
update public.subscriptions set plan = 'yearly' where plan = 'annual';
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('monthly', 'yearly'));
alter table public.subscriptions alter column provider set default 'asaas';

alter table public.messages
  add column if not exists cards jsonb not null default '[]',
  add column if not exists visible boolean not null default true;

alter table public.recurrences
  add column if not exists payment_method text
    check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other'));

alter table public.goals add column if not exists starts_on date not null default current_date;

alter table public.automations drop constraint if exists automations_schedule_check;
alter table public.automations
  add constraint automations_schedule_check check (schedule in ('daily', 'weekly', 'monthly', 'once')),
  add column if not exists channel text not null default 'push' check (channel in ('push', 'whatsapp', 'email'));

alter table public.focus_sessions add column if not exists title text check (length(title) <= 200);

alter table public.diet_meals add column if not exists kcal integer check (kcal is null or kcal >= 0);

commit;
