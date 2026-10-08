# Subir na VPS: app no Portainer, banco no Supabase

Arquitetura:

- **Supabase gerenciado:** Postgres, login, e-mails de conta e tempo real.
- **Sua VPS, pelo Portainer:** o app e um contêiner pequeno que roda a varredura de lembretes a cada minuto. Por isso o QStash não é necessário.

A imagem do app é montada pelo GitHub a cada push na `main` e não tem nenhuma chave dentro. Tudo se configura pelas variáveis do stack. Foi testada aqui: container saudável, rodando sem root, login, conversa, tempo real entre dois aparelhos e varredura.

Arquivos:

| arquivo | para quê |
| --- | --- |
| `Dockerfile` | imagem do app (Next standalone, Node 22, ~350 MB) |
| `.github/workflows/imagem.yml` | monta e publica `ghcr.io/vozzyup/cabeca-leve:latest` a cada push na `main` |
| `deploy/portainer-stack.yml` | stack para Docker Swarm + Traefik |
| `deploy/portainer-stack-simples.yml` | stack sem Swarm e sem Traefik: o app numa porta, atrás do seu proxy |
| `deploy/stack.env.example` | todas as variáveis, para preencher e colar no Portainer |

## 1. Supabase (uma vez)

1. Crie o projeto em supabase.com, na região **South America (São Paulo)**.
   - Para produção, use o plano **Pro**. O gratuito pausa o projeto depois de uma semana sem uso e não tem backup diário.
2. No seu computador, dentro da pasta do projeto, aplique as 8 migrações:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
3. Em **Authentication > URL Configuration**:
   - Site URL: `https://SEU_DOMINIO`
   - Redirect URLs: `https://SEU_DOMINIO/**`
4. Em **Authentication > Emails**:
   - Cole os três modelos de `supabase/templates/` (confirmação, senha nova, troca de e-mail) e os assuntos que estão em `supabase/config.toml`.
   - Em SMTP Settings, coloque o SMTP da Resend, para os e-mails saírem do seu domínio.
5. Em **Authentication > Sign In / Providers > Email**, deixe "Confirm email" ligado.
6. Em **Project Settings > API Keys**, copie a URL do projeto, a chave **publishable** e a chave **secret**.
   - A secret dá acesso total ao banco: ela só vai nas variáveis do Portainer, nunca no código nem no navegador.

## 2. Imagem no GitHub (automático)

- A cada push na `main`, a Action `imagem` publica a imagem nova. Acompanhe em GitHub > Actions.
- A imagem fica **privada**, porque tem o código do app. O Portainer precisa de acesso a ela:
  1. Em github.com > Settings > Developer settings > Personal access tokens (classic), crie um token só com `read:packages`.
  2. No Portainer, em **Registries > Add registry > Custom registry**, use o endereço `ghcr.io`, o seu usuário do GitHub e o token como senha.

## 3. DNS

Crie um registro **A** do seu domínio (ex.: `app.seudominio.com.br`) apontando para o IP da VPS. O Traefik (ou o seu proxy) emite o certificado HTTPS sozinho.

## 4. Stack no Portainer

1. Vá em **Stacks > Add stack**, com o nome `cabeca-leve`, e cole no Web editor:
   - `deploy/portainer-stack.yml`, se a sua VPS usa **Swarm + Traefik**. Confira o nome da rede do Traefik (`TRAEFIK_NETWORK`), o entrypoint e o certresolver; os padrões são `network_public`, `websecure` e `letsencryptresolver`.
   - `deploy/portainer-stack-simples.yml`, se não usa Swarm. O app fica na porta `APP_PORT` e você aponta o seu proxy para ela.
2. Em **Environment variables > Advanced mode**, cole o `deploy/stack.env.example` preenchido.
   - Gere o `CRON_SECRET` com `openssl rand -hex 32`.
   - Gere as chaves do push com `npx web-push generate-vapid-keys`.
3. Clique em **Deploy the stack**.

## 5. Ligar os serviços externos

| serviço | onde | o quê |
| --- | --- | --- |
| UAZAPI | webhook da instância (`POST /webhook`) | url `https://SEU_DOMINIO/api/webhooks/whatsapp?secret=SEU_UAZAPI_WEBHOOK_SECRET`, events `["messages"]`, excludeMessages `["wasSentByApi"]` |
| Asaas | Integrações > Webhooks | url `https://SEU_DOMINIO/api/webhooks/asaas`, eventos `CHECKOUT_*`, `SUBSCRIPTION_*`, `PAYMENT_*`, token = `ASAAS_WEBHOOK_TOKEN` (32+ caracteres) |
| Meta (depois) | App > WhatsApp > Configuração | callback `https://SEU_DOMINIO/api/webhooks/whatsapp`, token de verificação = `META_WEBHOOK_VERIFY_TOKEN`; modelos aprovados em `backend.md` |

## 6. Conferir

1. Abra `https://SEU_DOMINIO/api/health`. Deve responder `{"ok":true}`.
2. Crie sua conta em `https://SEU_DOMINIO/entrar` e confirme pelo e-mail.
3. Em **Ajustes > Testar aviso**, veja o resultado em cada canal.
4. Mande "gastei 10 no café" no app e no WhatsApp vinculado.
5. Nos logs do serviço `varredura` (no Portainer), não deve aparecer "varredura falhou" depois do primeiro minuto.

## Atualizar

1. Faça push na `main` e espere a Action `imagem` terminar.
2. No Portainer, abra o stack e clique em **Update the stack** com **Re-pull image**.
   - No Swarm, a troca é sem parada: o novo contêiner sobe antes de o antigo sair.
   - Se der errado, o Swarm volta sozinho para a versão anterior.
3. Para voltar a uma versão específica, troque `IMAGE` para `ghcr.io/vozzyup/cabeca-leve:<sha do commit>`.
4. **Migração nova** (pasta `supabase/migrations`): rode `npx supabase db push` **antes** de atualizar o stack.

## Backup e segurança

- **Banco:** backup diário do Supabase no plano Pro (7 dias). A recuperação até o minuto exato (PITR) é um adicional pago, se quiser.
- **Segredos:** só nas variáveis do stack. Nada de chave no repositório: o GitHub bloqueia o push se aparecer uma.
- **Réplicas:** deixe uma réplica do app. Mais de uma funciona (as travas ficam no banco), mas não é necessário no começo.
- **A varredura** precisa ser uma só. O stack já define `replicas: 1`.
