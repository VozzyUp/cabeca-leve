-- Sincronização ao vivo entre aparelhos: as tabelas que as telas mostram entram na
-- publicação do Realtime. O RLS (select das próprias linhas) vale também aqui.
alter publication supabase_realtime add table
  public.tasks, public.reminders, public.transactions, public.habits, public.habit_logs, public.messages,
  public.notices, public.notes, public.journal_entries, public.goals, public.goal_entries, public.projects, public.milestones,
  public.recurrences, public.categories, public.food_logs, public.workout_logs, public.body_measurements,
  public.focus_sessions, public.automations, public.channel_links, public.subscriptions, public.profiles;
