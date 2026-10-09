# Subir na VPS: app no Portainer, banco no Supabase

Como funciona:

- **Supabase:** Postgres, login, e-mails de conta e tempo real.
- **Sua VPS (Swarm + Traefik), pelo Portainer:** o app e um contêiner pequeno que chama a varredura de lembretes a cada minuto. O QStash não é necessário.
- **GitHub:** a cada push na `main`, a Action aplica as migrações novas no banco, monta a imagem e manda o Portainer atualizar o serviço. Você não precisa fazer nada além de subir uma vez.

A imagem não tem nenhuma chave dentro. No stack ficam só **7 valores de base**. Todas as outras chaves (Anthropic, Groq, UAZAPI, Asaas, Resend, push, Meta, suporte) você configura **depois, numa tela do próprio app**, em `/admin/configuracoes`. Elas ficam no banco, criptografadas.

| arquivo | para quê |
| --- | --- |
| `deploy/portainer-stack.yml` | o stack, no mesmo formato dos seus outros (rede `cloud`, `websecure`, `letsencryptresolver`) |
| `.github/workflows/imagem.yml` | migrações, imagem e aviso ao Portainer a cada push |
| `Dockerfile` | imagem do app (~350 MB, sem root, com checagem de saúde em `/api/health`) |
| `supabase/migrations/` | as 9 migrações do banco |
| `supabase/colar-no-sql-editor/` | as mesmas migrações em 20 arquivos pequenos, para colar no SQL Editor (plano C) |

## 1. Supabase (uma vez)

1. Crie o projeto na região **South America (São Paulo)**. Para produção, use o plano **Pro**: o gratuito pausa depois de uma semana sem uso e não tem backup diário.
2. Anote o **project ref**: está na URL `supabase.com/dashboard/project/<ref>`.
3. Em **Project Settings > API Keys**, copie a URL do projeto, a chave **publishable** e a chave **secret**. A secret dá acesso total ao banco: ela só vai nas variáveis do stack.

## 2. Criar as tabelas (escolha um caminho)

### Caminho A: pelo GitHub, sem colar nada (recomendado)

1. No Supabase, clique em **Connect** (no topo) e copie a string **Session pooler** (porta 5432, usuário `postgres.<ref>`). Troque `[YOUR-PASSWORD]` pela senha do banco (ela está em Project Settings > Database; se esqueceu, use "Reset database password").
2. No GitHub, em **Settings > Secrets and variables > Actions > New repository secret**, crie `SUPABASE_DB_URL` com essa string.
3. Em **Actions > imagem > Run workflow**, clique para rodar. O passo "aplicar migrações novas" cria todas as tabelas.
   - Use o **Session pooler**, e não a conexão direta: as máquinas do GitHub não enxergam a direta, que só tem IPv6.
4. A partir daí, toda migração nova que eu fizer é aplicada sozinha a cada push.

### Caminho B: pelo seu computador

```bash
git clone https://github.com/VozzyUp/cabeca-leve && cd cabeca-leve
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

### Caminho C: colando no SQL Editor

Abra `supabase/colar-no-sql-editor/` e rode os **20 arquivos em ordem** (01, 02, 03…). Em cada um: SQL Editor > New query > cole o arquivo inteiro > Run. Cada um deve terminar com "Success. No rows returned"; o último mostra uma tabela de conferência (`tabelas_publicas = 57`, `tabelas_no_realtime = 23`, `migracoes_no_historico = 9` e o resto `true`).

- Rode cada arquivo **uma vez**. Se um falhar, ele não deixa nada pela metade: corrija e rode só ele de novo.
- Confira que o projeto aberto é o certo (o ref na URL).
- Se o editor cortar o texto ao colar, o arquivo termina antes de `commit;`. Cada arquivo tem menos de 5.000 caracteres para isso não acontecer.

## 3. Login e e-mails do Supabase

1. Em **Authentication > URL Configuration**: Site URL `https://SEU_DOMINIO`; Redirect URLs `https://SEU_DOMINIO/**`.
2. Em **Authentication > Emails**, cole os três modelos de `supabase/templates/` (confirmação, senha nova, troca de e-mail) e os assuntos que estão em `supabase/config.toml`.
3. Em **Authentication > SMTP Settings**, coloque o SMTP do seu provedor (Resend, ou o da Hostinger que você já usa), para os e-mails saírem do seu domínio.
4. Em **Authentication > Sign In / Providers > Email**, deixe "Confirm email" ligado.

## 4. Segredos no GitHub (para a atualização automática)

Em **Settings > Secrets and variables > Actions**:

| segredo | valor | para quê |
| --- | --- | --- |
| `SUPABASE_DB_URL` | a string do passo 2 | aplicar migrações novas |
| `PORTAINER_WEBHOOK_URL` | o webhook do serviço (passo 6) | atualizar o app no Portainer |

Sem eles a imagem é publicada do mesmo jeito; só as etapas correspondentes avisam que foram puladas.

## 5. DNS e stack

1. Crie um registro **A** do seu domínio (ex.: `app.seudominio.com.br`) apontando para o IP da VPS.
2. No Portainer, **Stacks > Add stack**, nome `cabecaleve`, cole o `deploy/portainer-stack.yml` e troque os 7 valores `TROQUE_…`:

   | valor | de onde vem |
   | --- | --- |
   | `TROQUE_DOMINIO` (aparece 2 vezes) | o domínio, sem `https://` na regra do Traefik e com `https://` no `SITE_URL` |
   | `SUPABASE_URL` | Project Settings > API |
   | `SUPABASE_PUBLISHABLE_KEY` | a chave `sb_publishable_…` |
   | `SUPABASE_SECRET_KEY` | a chave `sb_secret_…` |
   | `APP_SECRET_KEY` | `openssl rand -hex 32`. Criptografa as chaves guardadas na tela de admin. **Não troque depois**, ou elas deixam de abrir |
   | `ADMIN_EMAILS` | o seu e-mail (o mesmo do cadastro no app) |
   | `CRON_SECRET` | `openssl rand -hex 32` (o mesmo valor nos dois serviços do stack) |

3. **Deploy the stack**. A imagem é `ghcr.io/vozzyup/cabeca-leve:latest`.
   - Se o pacote estiver **privado**, em **Registries > Add registry > Custom** use `ghcr.io`, o seu usuário do GitHub e um token (Settings > Developer settings > Personal access tokens) só com `read:packages`.
   - Como o repositório hoje é público, você também pode deixar o pacote público em GitHub > Packages > Package settings > Change visibility. Aí não precisa de login.

## 6. Webhook do Portainer (atualização automática)

1. No Portainer, abra o serviço `cabecaleve_cabecaleve_app` e ative **Service webhook**.
2. Copie a URL e guarde como o segredo `PORTAINER_WEBHOOK_URL` no GitHub.
3. Dali em diante, cada push na `main` troca o serviço para a imagem nova (a do commit exato), com subida antes da descida e **volta sozinho para a anterior se a nova não ficar saudável**.

## 7. Configurar as chaves pelo app

1. Abra `https://SEU_DOMINIO/entrar` e crie a conta com o e-mail de `ADMIN_EMAILS`. Confirme pelo e-mail.
2. Em **Ajustes**, aparece **Configuração do sistema**. Abra.
3. Preencha por grupo (cada grupo tem o seu botão Salvar, e vale na hora, sem reiniciar):

   | grupo | o que colocar |
   | --- | --- |
   | Assistente | chave da Anthropic |
   | Áudio | chave da Groq |
   | WhatsApp | provedor, número do assistente, endereço e token da UAZAPI; use **Gerar** no segredo do webhook |
   | Cobrança | ambiente (sandbox ou produção), chave da Asaas; use **Gerar** no token do webhook |
   | E-mail | chave da Resend e remetente |
   | Notificações | **Gerar** cria o par de chaves do push |
   | Suporte | e-mail e WhatsApp que recebem os chamados |

4. Clique em **Mostrar** em "Endereços para colar nos serviços": ali estão o webhook da UAZAPI (já com o segredo), o da Asaas e o token, para colar nos painéis deles.
5. Segredos aparecem na tela só com os 4 últimos caracteres. Para trocar, digite o valor novo. **Apagar** volta a valer o que estiver no stack.

## 8. Conferir

1. `https://SEU_DOMINIO/api/health` responde `{"ok":true}`.
2. Em **Ajustes > Testar aviso**, veja o resultado em cada canal.
3. Mande "gastei 10 no café" no app e no WhatsApp vinculado.
4. Nos logs do serviço `cabecaleve_varredura`, não deve aparecer "varredura falhou" depois do primeiro minuto.

## Atualizar

Faça nada: eu subo no GitHub e o resto é automático (migrações, imagem e Portainer). Para acompanhar, veja **Actions** no GitHub. Para voltar a uma versão antiga, troque a imagem do serviço para `ghcr.io/vozzyup/cabeca-leve:<sha do commit>`.

## Backup e segurança

- **Banco:** backup diário do Supabase no plano Pro (7 dias). A recuperação até o minuto exato é um adicional pago.
- **Segredos:** no stack só os 7 de base; os demais ficam criptografados no banco. Nada de chave no repositório: o GitHub bloqueia o push se aparecer uma.
- **A tela de admin** só abre para os e-mails de `ADMIN_EMAILS`. Quem tem acesso a ela vê (e troca) todas as chaves do sistema: dê só a quem precisa.
- **A varredura** precisa ser uma só: o stack define `replicas: 1` para ela.
