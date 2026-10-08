# Backend

Estado em 2026-10-08. Tudo foi construído e testado contra um **Supabase local**
(`npm run db:start`), com a Anthropic, a UAZAPI, a Groq e a Asaas simuladas nos testes.
Para ligar de verdade, crie as contas abaixo e preencha `.env.local` (modelo em `.env.example`).
Sem as variáveis do Supabase, o app continua no modo de demonstração (dados de exemplo, sem login).

## Como ligar (o que você faz)

| # | serviço | o que fazer | variáveis |
| --- | --- | --- | --- |
| 1 | **Supabase** | criar o projeto (região São Paulo), rodar `npx supabase link` e `npx supabase db push` (aplica as 6 migrações). Em Authentication > URL Configuration: Site URL = seu domínio; Redirect URLs = `https://seu-dominio/**`. Em Authentication > Emails: colar os textos de `supabase/templates/` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| 2 | **Anthropic** | criar a chave em console.anthropic.com | `ANTHROPIC_API_KEY` |
| 3 | **Groq** | criar a chave em console.groq.com | `GROQ_API_KEY` |
| 4 | **UAZAPI** | conectar a instância ao número do assistente; configurar o webhook da instância com `POST /webhook`: `url = https://seu-dominio/api/webhooks/whatsapp?secret=SEU_SEGREDO`, `events = ["messages"]`, `excludeMessages = ["wasSentByApi"]` | `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_TOKEN`, `UAZAPI_WEBHOOK_SECRET` (o SEU_SEGREDO acima), `WHATSAPP_BOT_NUMBER` |
| 5 | **Upstash QStash** | copiar o token e as chaves de assinatura; criar um agendamento (Schedules) a cada minuto (`* * * * *`) chamando `POST https://seu-dominio/api/cron/sweep` | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` |
| 6 | **Web Push** | `npx web-push generate-vapid-keys` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| 7 | **Asaas** (sandbox) | criar a chave de API do sandbox; criar o webhook (Integrações > Webhooks) para `https://seu-dominio/api/webhooks/asaas` com os eventos `CHECKOUT_*`, `SUBSCRIPTION_*` e `PAYMENT_*` e um token de 32+ caracteres; ativar a emissão de nota fiscal para assinaturas no painel | `ASAAS_API_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` |
| 8 | **Resend** | verificar o domínio (SPF, DKIM, DMARC) e colocar o SMTP da Resend no Supabase (Authentication > SMTP Settings). Os e-mails de login passam a sair do seu domínio. A chave de API manda o comprovante de cancelamento e os e-mails do suporte | `RESEND_API_KEY`, `EMAIL_FROM` (e o SMTP no painel do Supabase) |
| 9 | **Suporte humano** | criar sua conta no app com o e-mail do time; definir para onde vão os avisos de chamado novo. Responder em `https://seu-dominio/suporte/painel` | `ADMIN_EMAILS`, `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` |

Depois de preencher: `npm run dev` e criar a primeira conta pelo `/entrar`.

## O que foi construído

| área | como funciona | arquivos |
| --- | --- | --- |
| banco | 6 migrações (53 tabelas do esquema + ajustes das telas + checkout + correções); RLS em todas: o navegador só lê as próprias linhas, toda escrita passa pelo servidor filtrando por `user_id` | `supabase/migrations/` |
| camada de dados | `DataStore` com duas implementações: Supabase (por usuário) e demonstração (arquivo). As telas não mudaram | `lib/data/` |
| login | e-mail e senha com confirmação por e-mail, recuperar senha, sair (neste aparelho ou em todos); sessão em cookie http-only renovada pelo `proxy.ts`; quem não entrou vai para `/entrar` | `app/auth-actions.ts`, `proxy.ts`, `app/auth/confirm` |
| exclusão de conta | apaga o usuário no Auth e tudo dele em cascata (testado com conversa e notas) | `lib/data/supabase-store.ts` |
| agente | Claude Opus 5.5 (`claude-opus-5-5`) pelo Tool Runner, 21 ferramentas estritas (criar, consultar, editar e apagar), esquema sem os limites que a API não aceita (o Zod confere no servidor), esforço `low`, cache do prompt, reserva automática em recusas (`fallbacks: "default"`), histórico do dia reenviado byte a byte; sem chave, usa o intérprete de regras | `lib/assistant/agent.ts` |
| limites | 12 mensagens por minuto e 400 por dia por pessoa (custo de IA e abuso) | `lib/assistant/index.ts` |
| WhatsApp | interface única com UAZAPI (agora) e WhatsApp Cloud API da Meta (pronta); vínculo do número por código enviado do próprio celular; respostas com uma linha por item salvo; mensagem repetida não roda duas vezes | `lib/whatsapp/` |
| áudio | Groq `whisper-large-v3-turbo` em português: áudios do WhatsApp e ditado no app quando o navegador não reconhece voz | `lib/transcribe.ts`, `app/api/transcribe` |
| entregas | varredura de cada minuto: lembretes vencidos e resumo da manhã por push e WhatsApp, com reserva em `scheduled_deliveries` (nada sai em dobro) e registro em Avisos | `lib/deliveries.ts`, `app/api/cron/sweep` |
| push | Web Push com service worker; ligado em Ajustes > Notificações no aparelho | `lib/push.ts`, `public/sw.js` |
| repetição | lembretes e tarefas que se repetem (todo dia, dias úteis, dias da semana, todo mês) em RRULE; a entrega reagenda o lembrete e concluir a tarefa cria a próxima | `lib/domain/recurrence.ts` |
| tempo real | Supabase Realtime nas tabelas das telas; o navegador entra com o token da sessão, então o RLS só entrega as linhas da pessoa | `components/realtime-sync.tsx` |
| confiança (F1 a F3) | cancelar dá protocolo, aviso e e-mail, e cobrança de período depois do cancelamento é estornada sozinha; quem volta da página de pagamento usa o app por até 2 h enquanto a Asaas confirma; "falar com uma pessoa" abre chamado com protocolo e prazo (1 dia útil), avisa o time por e-mail e WhatsApp, e a resposta do painel chega pelo app, WhatsApp e e-mail | `lib/billing/asaas.ts`, `lib/support.ts`, `app/(app)/ajustes/suporte`, `app/(app)/suporte/painel` |
| cobrança | Asaas Checkout hospedado: mensal recorrente no cartão; anual em pagamento único por Pix ou cartão. Webhook idempotente atualiza `subscriptions`; cancelar em um toque (acesso até o fim do período); sem plano e com o teste vencido, o assistente explica e não roda | `lib/billing/asaas.ts`, `app/api/webhooks/asaas` |

## Testes

```bash
npm test                 # 44 testes de unidade
npm run db:start         # Supabase local (Docker)
npm run test:int         # 23 testes de integração: banco, isolamento entre usuários, agente, WhatsApp, entregas e cobrança
node scripts/auth-check.cjs   # login de ponta a ponta no navegador (com npm run dev)
node scripts/musts-check.cjs replica/clone-screens  # repetição, edição, categorias, filtros, áudio e tempo real entre dois aparelhos
```

## Checklist de segurança

- [x] segredos só em variáveis de ambiente; `.env*` no `.gitignore` (menos `.env.example`); nada de chave no navegador além da pública do Supabase e da VAPID
- [x] entrada validada no servidor (Zod) em todas as rotas e ações
- [x] autorização em toda leitura e escrita: filtro por `user_id` + FKs compostas + RLS; **testado com um segundo usuário** (não vê nem altera nada, nem pelo navegador)
- [x] limites: Supabase Auth limita cadastro, login e e-mails; o app limita mensagens por pessoa
- [x] webhooks conferem a origem: Meta (assinatura HMAC), UAZAPI (segredo na URL + token da instância), Asaas (token no cabeçalho), QStash e varredura (assinatura ou `CRON_SECRET`)
- [x] uploads: áudio do ditado até 10 MB e só tipos de áudio; mídia do WhatsApp é baixada no servidor e não fica guardada
- [x] nada de dado do usuário em URL ou log (logs só com códigos de erro)
- [x] `npm audit --omit=dev`: 0 vulnerabilidades
- [x] cabeçalhos de segurança (X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy)
- [ ] política de privacidade listando os operadores: Supabase, Vercel, Anthropic, Groq, UAZAPI (depois Meta), Upstash, Asaas, Resend (página escrita no `/replica-launch`)
- [ ] backups: ativar no plano do Supabase (o gratuito não tem backup diário)

## Pendências e riscos

- **UAZAPI não é a API oficial do WhatsApp.** O número pode ser bloqueado pelo WhatsApp, sobretudo com muitas mensagens proativas (lembretes, resumos). Use um número dedicado. Para migrar: preencher as variáveis `META_*`, mudar `WHATSAPP_PROVIDER=meta` e apontar o webhook da Meta para `/api/webhooks/whatsapp`. Na Meta, mensagens fora da janela de 24 h exigem **modelos aprovados** (lembrete, resumo, aviso): o envio por modelo ainda não está implementado e é o próximo passo dessa migração.
- **Agendas (Google e Outlook):** a tela está pronta e desconectar funciona; conectar exige criar os apps OAuth e passar pela verificação do Google (semanas). Não implementado.
- **Revisões agendadas (S27):** a lista e o pausar funcionam; gerar a revisão com o Claude no horário ainda não.
- **Streaming da resposta:** o agente responde de uma vez (alguns segundos); mostrar o texto chegando aos poucos fica para depois.
- **Memória do assistente e busca por sentido (embeddings):** não implementadas.
- **Nota fiscal:** emitida pela própria Asaas; ativar no painel.
- **Custo da IA:** medir com uso real (as mensagens guardam tokens de entrada, saída e cache).
