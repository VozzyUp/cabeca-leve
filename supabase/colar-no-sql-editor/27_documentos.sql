-- Cabeça Leve, passo 27 de 27: documentos (notas fiscais, recibos, pedidos médicos) com pastas, status de reembolso e prazo.
-- Supabase > SQL Editor > New query > cole TUDO > Run. Rode uma vez, depois do 26.
-- (Se a Action de deploy já aplicou as migrações, não rode: as tabelas já existiriam e dá erro.)
-- Cria também o bucket PRIVADO "documents" no Storage. Deve terminar com uma linha de conferência:
-- pastas = true, documentos = true, bucket_privado = true, migracoes_no_historico = 16.

begin;

-- Documentos: notas fiscais, recibos, pedidos médicos e outros papéis guardados em pastas, com status de
-- reembolso e prazo. O arquivo original fica num bucket privado do Storage (nunca público): o app só o
-- entrega por uma rota autenticada, que confere o dono antes de baixar.

-- 1) Pastas ("Viagem SP", "Convênio"). O prazo padrão conta a partir da data do documento.
create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  deadline_days integer check (deadline_days is null or deadline_days between 1 and 730),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index document_folders_name_idx on public.document_folders (user_id, lower(btrim(name)));

-- 2) Documentos. status nulo = só guardado (pedido médico, exame): não entra na conta de reembolso.
--    Para o resto: pending (a pedir), submitted (pedido enviado), reimbursed (reembolsado).
--    alert_stage evita avisar duas vezes do mesmo prazo: 0 nada enviado, 1 aviso de 7 dias, 2 aviso de 2 dias.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid,
  title text not null check (length(btrim(title)) between 1 and 120),
  issuer text check (issuer is null or length(issuer) between 1 and 120),            -- quem emitiu: profissional ou estabelecimento
  beneficiary text check (beneficiary is null or length(beneficiary) between 1 and 80),  -- para quem foi: você, filho, esposa...
  category text check (category is null or length(category) between 1 and 60),
  doc_date date,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  status text check (status in ('pending', 'submitted', 'reimbursed')),
  due_on date,
  submitted_on date,
  reimbursed_on date,
  alert_stage smallint not null default 0 check (alert_stage between 0 and 2),
  notes text check (notes is null or length(notes) <= 2000),
  file_path text not null unique,                       -- <user_id>/<id>.<ext> no bucket 'documents'
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),  -- 25 MB
  source text not null default 'web' check (source in ('web', 'whatsapp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- apagar a pasta não apaga os documentos: eles ficam sem pasta
  foreign key (folder_id, user_id) references public.document_folders (id, user_id) on delete set null (folder_id)
);
create index documents_user_status_idx on public.documents (user_id, status, due_on);
create index documents_user_folder_idx on public.documents (user_id, folder_id);
create index documents_user_date_idx on public.documents (user_id, doc_date desc nulls last, created_at desc);

-- só o servidor (rotas autenticadas com a chave secreta) mexe nessas tabelas
alter table public.document_folders enable row level security;
alter table public.documents enable row level security;
revoke all on public.document_folders, public.documents from anon, authenticated;

-- 3) Bucket privado. Sem política de acesso: nem anon nem authenticated leem ou gravam; só a chave secreta do servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations (version, name) values ('20261015000100', 'documentos')
  on conflict (version) do nothing;

commit;

select
  to_regclass('public.document_folders') is not null as pastas,
  to_regclass('public.documents') is not null as documentos,
  exists (select 1 from storage.buckets where id = 'documents' and public = false) as bucket_privado,
  (select count(*) from supabase_migrations.schema_migrations) as migracoes_no_historico;
