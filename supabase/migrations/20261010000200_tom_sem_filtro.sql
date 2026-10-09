-- Tom "Sem filtro" (tough): o amigo sincerão que zoa e puxa a orelha
alter table public.profiles drop constraint if exists profiles_assistant_tone_check;
alter table public.profiles add constraint profiles_assistant_tone_check
  check (assistant_tone in ('direct', 'warm', 'playful', 'tough', 'custom'));
