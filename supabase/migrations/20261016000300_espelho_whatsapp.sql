-- Espelho no WhatsApp: quando ligado, o que a pessoa conversa no app também vai para o WhatsApp dela (a pergunta e a
-- resposta), para as duas conversas ficarem iguais. Desligado por padrão: faz o celular tocar a cada mensagem do app.
alter table public.profiles add column mirror_whatsapp boolean not null default false;
