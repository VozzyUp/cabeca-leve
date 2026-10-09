-- Cabeça Leve, passo 14 de 20: banco principal (funções, views, cadastro e segurança).
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode os passos em ordem, uma vez cada.
-- Deve terminar com: Success. No rows returned.

begin;

do $$
declare
  t text;
  -- tabelas que o navegador pode LER (só as próprias linhas)
  readable text[] := array[
    'profiles', 'subscriptions', 'channel_links', 'push_subscriptions',
    'conversations', 'messages', 'attachments', 'actions', 'memories',
    'categories', 'accounts', 'cards', 'card_invoices', 'installment_purchases', 'recurrences',
    'project_templates', 'projects', 'milestones', 'tasks', 'reminders', 'scheduled_deliveries',
    'focus_sessions', 'habits', 'habit_logs', 'transactions', 'budgets', 'statement_imports',
    'goals', 'goal_entries', 'notebooks', 'notes', 'note_links', 'journal_entries',
    'integrations', 'calendars', 'calendar_events', 'automations', 'automation_runs',
    'alert_rules', 'alert_events',
    'workout_plans', 'workout_plan_sessions', 'workout_plan_exercises', 'workout_logs',
    'workout_sets', 'diet_plans', 'diet_meals', 'food_logs', 'body_measurements', 'health_samples'
  ];
  -- tabelas só do servidor (RLS ligado, nenhuma política)
  server_only text[] := array['billing_events', 'integration_secrets', 'embeddings'];
begin
  foreach t in array readable || server_only loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
  foreach t in array readable loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
  end loop;
end $$;

commit;
