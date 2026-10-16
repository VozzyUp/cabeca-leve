-- Diagnóstico do sistema: o último sinal de cada serviço (por exemplo, a última mensagem que o webhook do WhatsApp
-- recebeu e o que fez com ela), para o time ver em Administração quando algo "não responde".
create table public.system_status (
  key text primary key check (length(key) between 1 and 60),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.system_status enable row level security;
revoke all on public.system_status from anon, authenticated;
