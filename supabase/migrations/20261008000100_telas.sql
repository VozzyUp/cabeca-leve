-- =============================================================================
-- Ajustes do esquema ao que as telas construídas no /replica-build usam.
-- =============================================================================

-- Perfil: preferências das telas S29 e S30
alter table public.profiles drop constraint if exists profiles_check;
alter table public.profiles drop constraint if exists profiles_assistant_tone_check;
update public.profiles set assistant_tone = 'warm';
alter table public.profiles
  alter column assistant_tone set default 'warm',
  add constraint profiles_assistant_tone_check
    check (assistant_tone in ('direct', 'warm', 'playful', 'custom')),
  add constraint profiles_tone_custom_check
    check (assistant_tone <> 'custom' or assistant_tone_custom is not null),
  add column answer_length text not null default 'short' check (answer_length in ('short', 'detailed')),
  add column memory_enabled boolean not null default true,
  add column notify_push boolean not null default true,
  add column notify_email boolean not null default true,
  add column notify_telegram boolean not null default false,
  add column trial_ends_on date not null default (current_date + 7);
alter table public.profiles alter column assistant_voice set default 'female';
update public.profiles set assistant_voice = 'female' where assistant_voice is null;
alter table public.profiles alter column briefing_time set default '07:00';

-- Assinatura: o plano anual se chama 'yearly' nas telas
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
update public.subscriptions set plan = 'yearly' where plan = 'annual';
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('monthly', 'yearly'));
alter table public.subscriptions alter column provider set default 'asaas';

-- Conversa: cards de ação mostrados na tela e se a mensagem aparece no histórico.
-- O conteúdo (blocos da API) continua somente-anexar; os cards podem mudar ("desfeito").
alter table public.messages
  add column cards jsonb not null default '[]',
  add column visible boolean not null default true;

-- Fixos: forma de pagamento (pix, débito...) para os lançamentos gerados
alter table public.recurrences
  add column payment_method text
    check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other'));

-- Metas: início, para calcular o ritmo
alter table public.goals add column starts_on date not null default current_date;

-- Revisões agendadas: canal de entrega e repetição mensal (dia 1)
alter table public.automations drop constraint if exists automations_schedule_check;
alter table public.automations
  add constraint automations_schedule_check check (schedule in ('daily', 'weekly', 'monthly', 'once')),
  add column channel text not null default 'push' check (channel in ('push', 'whatsapp', 'email'));

-- Modo foco: no que a pessoa focou
alter table public.focus_sessions add column title text check (length(title) <= 200);

-- Dieta: calorias por refeição do plano
alter table public.diet_meals add column kcal integer check (kcal is null or kcal >= 0);

-- Avisos (S28): caixa de entrada do que o assistente mandou
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'briefing', 'automation', 'bill', 'system')),
  title text not null check (length(title) between 1 and 120),
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notices (user_id, created_at desc);
alter table public.notices enable row level security;
create policy notices_select_own on public.notices for select to authenticated using (user_id = (select auth.uid()));
create trigger notices_set_updated_at before update on public.notices for each row execute function public.set_updated_at();

-- Cadastro: conta corrente zerada e aviso de boas-vindas, além do que já existia
create or replace function public.handle_new_user_extras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (user_id, name) values (new.id, 'Conta corrente');
  update public.profiles set display_name = nullif(new.raw_user_meta_data ->> 'name', '') where user_id = new.id;
  insert into public.notices (user_id, kind, title, body, href)
  values (new.id, 'system', 'Bem-vindo', 'Conte o que precisa na conversa: tarefas, gastos, lembretes, hábitos.', '/conversa');
  return new;
end $$;

create trigger on_auth_user_created_extras after insert on auth.users
  for each row execute function public.handle_new_user_extras();
