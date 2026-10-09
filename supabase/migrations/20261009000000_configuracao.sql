-- Configuração do sistema editada na tela de admin (/admin/configuracoes): chaves de
-- Anthropic, Groq, UAZAPI, Meta, Asaas, Resend, push e suporte. O valor fica criptografado
-- (AES-256-GCM) com APP_SECRET_KEY, que só existe nas variáveis do stack. Sem políticas de RLS:
-- nem o navegador nem a chave pública leem esta tabela; só o servidor, com a chave secreta.
create table public.app_settings (
  key text primary key check (key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value_encrypted text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
