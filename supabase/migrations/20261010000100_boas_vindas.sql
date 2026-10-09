-- Configuração inicial (boas-vindas): quem ainda não passou por ela vê o passo a passo ao entrar.
-- Contas que já existiam contam como configuradas (dá para refazer em Ajustes).
alter table public.profiles add column if not exists onboarded_at timestamptz;
update public.profiles set onboarded_at = now() where onboarded_at is null;
