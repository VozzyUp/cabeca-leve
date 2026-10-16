-- Pagamento dentro do app (Pix, boleto ou cartão pela API da Asaas, sem abrir a página de checkout deles).
-- checkout_sessions passa a guardar cada tentativa de pagamento: o id é o da cobrança (pay_...) ou da assinatura (sub_...).
alter table public.checkout_sessions drop constraint if exists checkout_sessions_status_check;
alter table public.checkout_sessions add constraint checkout_sessions_status_check check (status in ('pending', 'paid', 'canceled', 'expired', 'failed'));
alter table public.checkout_sessions add column method text check (method in ('pix', 'boleto', 'card'));
alter table public.checkout_sessions add column kind text not null default 'checkout' check (kind in ('checkout', 'payment', 'subscription'));
alter table public.checkout_sessions add column info jsonb not null default '{}'::jsonb;   -- Pix (código e QR), boleto (linha e link), valor, vencimento
alter table public.checkout_sessions add column failure text;                                 -- motivo da recusa, em português
create index on public.checkout_sessions (user_id, created_at desc);

-- A pessoa na Asaas: um cadastro por conta, reaproveitado a cada tentativa (o CPF fica só na Asaas)
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;
