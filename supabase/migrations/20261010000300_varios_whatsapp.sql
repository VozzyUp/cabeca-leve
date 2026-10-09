-- Vários WhatsApps na mesma conta (casal, família): cada número tem o nome de quem usa e
-- escolhe se recebe os avisos. O limite de números por plano fica no app (Admin > Configurações).
alter table public.channel_links drop constraint if exists channel_links_user_id_channel_key;
create unique index if not exists channel_links_user_number_unique on public.channel_links (user_id, channel, external_id);
alter table public.channel_links
  add column if not exists label text check (label is null or length(label) between 1 and 40),
  add column if not exists receives_notices boolean not null default true;

-- quem lançou: o nome do número que mandou a mensagem (vazio quando veio do app)
alter table public.transactions add column if not exists author text check (author is null or length(author) between 1 and 40);
