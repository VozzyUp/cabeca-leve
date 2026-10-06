# Arquitetura: assistente pessoal com IA (reconstrução das funções do Néctar)

Nome provisório: o nome definitivo sai do `/replica-brand`.
Base: `replica/recon.md` (38 telas, 21 fluxos) e `replica/features.csv` (142 funcionalidades).
Primeira versão na **Web + WhatsApp**, para vender no Brasil. Data: 2026-10-06.

Princípio: o clone não copia a arquitetura do original, só as funções. Um banco de
dados, um projeto Next.js e serviços gerenciados. Nada de microsserviços.

## Stack

É a mesma família de tecnologias que você já usa, num projeto novo e sem código compartilhado.

| camada | escolha | por quê |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript + React | você já conhece; telas e rotas de API no mesmo projeto |
| app no celular (v1) | PWA: manifest + service worker | instala na tela inicial e recebe push, sem loja, até existir app nativo |
| estilo | Tailwind CSS v4 + shadcn/ui (Radix) | recebe os tokens do `/replica-design`; componentes acessíveis prontos |
| mobile nativo (F3) | Expo (React Native) | widgets, Live Activities, Apple Watch e Apple Saúde exigem app nativo |
| banco | Postgres no Supabase | RLS por usuário, Auth, Storage, Realtime e pgvector num serviço só |
| acesso a dados | migrações SQL (Supabase CLI) + supabase-js com tipos gerados | sem ORM, como você já trabalha; `schema.sql` vira as migrações |
| auth | Supabase Auth (e-mail e senha; Google depois) | integra com o RLS; recuperação de senha pronta |
| IA (agente) | Claude Opus 5.5 (`claude-opus-5-5`) pelo SDK oficial `@anthropic-ai/sdk`, com o Tool Runner | modelo padrão atual da Anthropic; ferramentas com esquema estrito, cache de prompt e fallback em recusas saem primeiro no SDK oficial |
| transcrição de áudio | provedor de fala-para-texto com bom português (decidir no `/replica-backend`) | a documentação da API da Anthropic não cobre entrada de áudio |
| busca por sentido | pgvector + modelo de embeddings de outro provedor (decidir no backend) | a documentação da API da Anthropic não cobre embeddings |
| WhatsApp | WhatsApp Cloud API, direto com a Meta | sem intermediário; você já conhece; custo direto da Meta |
| filas e agendamento | Upstash QStash (entregas no horário) + Vercel Cron (varreduras) | entrega com nova tentativa e atraso exato; você já usa |
| limites de uso | Upstash Redis (ratelimit) | protege login, chat e o custo de IA contra abuso |
| push | Web Push (VAPID) | padrão aberto, sem fornecedor |
| pagamentos | Stripe Checkout + Billing + Customer Portal | assinatura mensal e anual, cancelamento em um clique; ver nota abaixo sobre Pix e nota fiscal |
| e-mail | Resend | ativação, senha e recibos saindo do seu domínio |
| arquivos | Supabase Storage (bucket privado) | áudios, fotos e documentos, cada usuário na própria pasta |
| hospedagem | Vercel | Next.js nativo, cron e preview por pull request |
| monitoramento | Sentry + analytics com privacidade (PostHog ou Plausible) | erros e funil de assinatura |
| testes | Vitest + Playwright | você já usa; o `/replica-test` escreve os testes |

**Pagamentos no Brasil:** confirme no painel da Stripe se Pix está disponível para
assinaturas na sua conta. Se não estiver, o plano anual pode ser pago por Pix como
pagamento único. A Stripe não emite nota fiscal brasileira, então seria preciso um
emissor de NFS-e à parte. A alternativa nacional é a **Asaas**: assinaturas por Pix,
boleto ou cartão, com emissão de nota fiscal. Decidimos no `/replica-backend`; o esquema já aceita os dois
(`subscriptions.provider`).

### Como o assistente funciona

- **Loop do agente:** Tool Runner do SDK oficial (`betaZodTool` + `client.beta.messages.toolRunner`),
  com resposta em streaming. Cada ferramenta tem esquema Zod, `strict: true` e
  `eager_input_streaming: true`, e a entrada é validada antes de executar.
- **Escolha de ferramenta:** sempre `tool_choice: auto`. O Opus 5.5 recusa uso forçado de
  ferramenta (`any` ou `tool` dão erro 400).
- **Várias ações numa mensagem:** o modelo chama várias ferramentas em paralelo, por
  exemplo `create_reminder` e `record_transaction` juntas. Os resultados voltam todos numa
  única mensagem.
- **Esforço:** `output_config.effort: "low"`, explícito, porque o padrão do Opus 5.5 é
  `medium`. Subimos só se uma avaliação com mensagens reais mostrar ganho. O raciocínio do
  modelo fica sempre ligado (no Opus 5.5 não dá para desligar); a tela mostra as nossas
  "etapas" (a partir das chamadas de ferramenta), não o raciocínio.
- **Recusas:** tratar `stop_reason: "refusal"` e ligar o fallback do servidor
  (`fallbacks: "default"` com o cabeçalho beta `server-side-fallback-2026-07-01`), que
  refaz o pedido em outro modelo quando há uma recusa. Ligado por padrão.
- **Cache de prompt:** o prompt de sistema e a lista de ferramentas são **iguais para
  todos os usuários** e não mudam entre pedidos. Assim o prefixo fica em cache e é
  reaproveitado. O que varia (nome, tom, memórias, data e hora) entra no fim da conversa,
  nunca no prompt de sistema.
- **Histórico somente-anexar:** o Opus 5.5 confere se o histórico reenviado não foi
  editado ("preserved thinking"; contas criadas a partir de 31/08/2026 já são conferidas).
  Por isso:
  - cada mensagem é guardada como os blocos exatos da API e reenviada byte a byte;
  - um trigger no banco impede editar `messages`;
  - o contexto do dia (nome, tom, memórias) entra como mensagem `system` logo depois da
    primeira mensagem do usuário no dia (a API não aceita `system` como primeira mensagem);
  - a data e a hora entram no texto de cada mensagem do usuário.
- **Conversas:** uma por usuário por dia local, para manter o histórico curto e barato. A
  tela mostra o histórico atravessando os dias. Os dias anteriores ficam acessíveis pelas
  ferramentas de consulta e pela memória. Se uma conversa crescer demais, usamos a
  compactação do servidor (beta `compact-2026-01-12`).
- **Desfazer:** toda ferramenta que escreve registra em `actions` o estado antes e depois.
  "Desfazer" restaura o estado anterior. Se o item mudou depois da ação, avisa em vez de
  sobrescrever. Apagar é arquivar, então também dá para desfazer.
- **Segurança:** o que vem de fora (mensagem encaminhada, evento de agenda, página da web)
  é dado, não instrução. As ferramentas só agem nos dados do próprio usuário. O que sai da
  conta, como convite de reunião para outra pessoa, pede confirmação.

**Custo estimado (grosseiro, medir antes de decidir):** preços atuais do Opus 5.5 são
US$ 4 por milhão de tokens de entrada, US$ 20 por milhão de saída e US$ 0,20 por milhão
lidos do cache. Uma mensagem típica, com 2 chamadas ao modelo, prefixo de cerca de 8 mil
tokens em cache e 600 tokens de saída, custa em torno de **US$ 0,02**. Dá algo como
US$ 6/mês para quem manda 10 mensagens por dia e US$ 18/mês para quem manda 30, contra
R$ 49,90 de assinatura. Usar Claude Sonnet 5.5 (US$ 2 e US$ 10) ou Claude Haiku 4.5
(US$ 1 e US$ 5) em parte das rotas reduz isso. **A troca é decisão sua**, depois de medir
a qualidade com uma avaliação (`/claude-api build-eval` e `/claude-api cost-optimize`).
Fora a IA, entram o WhatsApp (modelos de mensagem fora da janela de 24 h são cobrados por
mensagem), a transcrição de áudio e os embeddings.

## Esquema

Arquivo: `replica/schema.sql` (1.315 linhas) e o teste `replica/schema-test.mjs`.
**53 tabelas e 2 views**, com 25 testes passando num Postgres local.

Regra de acesso, escrita explicitamente: **as duas coisas.**

1. **RLS do Postgres** em todas as tabelas. O navegador só **lê** as linhas do próprio usuário
   (telas e Realtime). Segredos de integração, eventos de pagamento e vetores não têm
   política nenhuma, então só o servidor acessa.
2. **Escrita só pelo servidor:** rotas e ferramentas validam com Zod e usam a service role
   do Supabase. Por isso **toda consulta do servidor passa pela camada de dados com
   `user_id` obrigatório**.

| área | tabelas | fase |
| --- | --- | --- |
| conta | profiles, subscriptions, billing_events, channel_links, push_subscriptions | F1 |
| conversa | conversations, messages, attachments, actions | F1 |
| conversa | memories | F2 |
| tarefas e lembretes | tasks, reminders, scheduled_deliveries | F1 |
| tarefas e lembretes | focus_sessions | F2 |
| hábitos | habits, habit_logs | F1 |
| finanças | categories, accounts, transactions | F1 |
| finanças | cards, card_invoices, installment_purchases, recurrences | F2 |
| finanças | budgets, statement_imports | F3 |
| projetos e metas | project_templates, projects, milestones, goals, goal_entries | F2 |
| conhecimento | notebooks, notes, journal_entries, embeddings | F2 |
| conhecimento | note_links | F3 |
| agenda | integrations, integration_secrets, calendars, calendar_events | F2 |
| automações e avisos | automations, automation_runs, alert_rules, alert_events | F2 |
| saúde | workout_plans, workout_plan_sessions, workout_plan_exercises, workout_logs, workout_sets, diet_plans, diet_meals, food_logs, body_measurements, health_samples | F3 |
| views | account_balances, card_invoice_totals | F1 e F2 |

Restrições difíceis resolvidas no banco, não na tela (todas cobertas pelo teste):

- **Nada aponta para outro usuário:** as FKs são compostas `(id, user_id)`. Uma tarefa de B
  não consegue apontar para um projeto de A, mesmo com bug no servidor.
- **Histórico da conversa imutável:** um trigger bloqueia edição de `messages`.
- **Reentrega não duplica:** a mesma mensagem do WhatsApp (`channel, external_message_id`),
  o mesmo envio pelo app (`user_id, client_message_id`), o mesmo evento da Stripe
  (`provider, event_id`), a mesma entrega agendada (`dedupe_key`), a mesma execução de
  automação (`automation_id, scheduled_for`) e o mesmo aviso (`dedupe_key`) entram uma vez só.
- **Hábito:** um registro por hábito por dia. Dois aparelhos marcando juntos não duplicam.
- **Saldo nunca guardado:** a view `account_balances` calcula o saldo. Dois lançamentos
  simultâneos não corrompem o valor. Compra no crédito não mexe no saldo da conta; entra
  na fatura (`card_invoice_totals`).
- **Recorrências:** gerar os lançamentos previstos de novo não duplica (`recurrence_id, occurred_on`).
- **Histórico financeiro protegido:** conta ou cartão com lançamentos não pode ser apagado,
  só arquivado. A exclusão da conta do usuário apaga tudo em cascata.
- **WhatsApp:** um número só pode estar verificado em uma conta. Tentativas sem verificar
  não bloqueiam ninguém.
- **Busca por texto** ignora acentos (configuração `pt_unaccent`).
- **Cadastro:** cria perfil, 14 categorias e 8 regras de aviso padrão (trigger `handle_new_user`).

Fora do SQL, a configurar no Supabase:

- **Storage:** bucket `attachments` privado, caminho `<user_id>/<arquivo>`, política de leitura
  só da própria pasta.
- **Realtime:** publicação das tabelas que as telas acompanham (tasks, reminders,
  transactions, habit_logs, messages).

## API

Rotas Next.js (route handlers). "Usuário" significa sessão válida do Supabase e assinatura
ativa, ou dentro do período de teste.

### F01, F03, F20: conversa

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| POST /api/chat | recebe a mensagem, roda o agente, devolve a resposta em stream | usuário | clientMessageId, texto, anexos | stream: texto, cards de ação, fim | F01, F03 |
| GET /api/chat/history | histórico paginado, atravessando os dias | usuário | cursor, limite | mensagens e cards | F01 |
| POST /api/actions/{id}/undo | desfaz uma ação do assistente | usuário dono | — | item restaurado e card atualizado | F01 |
| POST /api/uploads | URL assinada para enviar áudio, foto ou documento ao Storage | usuário | tipo, mime, tamanho | attachmentId, uploadUrl | F01, F06 |
| POST /api/attachments/{id}/transcribe | transcreve um áudio (ditado) | usuário dono | — | texto | F01, F20 |
| GET /api/briefing | briefing do dia | usuário | data | resumo e cards | F14 |
| POST /api/voice/session | abre sessão do modo de voz (F2) | usuário | — | credencial temporária do provedor de voz | F20 |

### Ferramentas do assistente

Chamadas pelo modelo dentro de `POST /api/chat` e dos jobs. Todas recebem o `user_id`
da sessão; o modelo nunca escolhe o usuário.

| ferramenta | faz | fase |
| --- | --- | --- |
| create_task, update_task | criar; editar, mover no quadro, concluir, arquivar | F1 |
| create_reminder, update_reminder | criar (com recorrência e canais); editar, adiar, concluir | F1 |
| record_transaction, update_transaction | lançar despesa, receita ou transferência; editar, arquivar | F1 |
| create_habit, log_habit | criar hábito; marcar como feito | F1 |
| query_tasks, query_reminders, query_finance, query_habits, get_day_overview | responder perguntas com dados e cards | F1 |
| undo_last_action | desfazer a última ação pedida na conversa | F1 |
| create_project, update_project, create_goal, update_goal, query_projects_goals | projetos, marcos e metas | F2 |
| manage_card, manage_recurrence | cartões, parceladas e recorrências | F2 |
| create_note, search_knowledge | guardar nota; buscar por sentido em notas, diário e conversas | F2 |
| query_calendar, create_calendar_event, update_calendar_event | agenda; convite para outra pessoa pede confirmação | F2 |
| create_automation | criar revisão agendada pela conversa | F2 |
| remember_fact, forget_fact | memória do assistente | F2 |
| log_workout, log_meal, log_body_measurement | saúde | F3 |
| request_ride | card com destino pronto no app da Uber (link público da Uber) | F3 |
| web_search (ferramenta de servidor da Anthropic) | pesquisar e resumir antes de salvar uma nota | F3 |

### F02, F16: WhatsApp

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/webhooks/whatsapp | verificação do webhook pela Meta | Meta (token de verificação) | hub.challenge | challenge | F02 |
| POST /api/webhooks/whatsapp | recebe mensagens, áudios, fotos e status; responde 200 na hora e enfileira | Meta (assinatura X-Hub-Signature-256) | evento | 200 | F02, F16 |
| POST /api/channels/whatsapp/link | inicia o vínculo: código de uso único e link wa.me | usuário | número | link e validade | F16 |
| DELETE /api/channels/whatsapp | desvincula o número | usuário | — | — | F16 |

### F04, F13, F14: lembretes, avisos e push

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/reminders | lista por período e status | usuário | filtros | lembretes | F04 |
| POST /api/reminders | cria | usuário | título, quando, recorrência, canais | lembrete | F04 |
| PATCH /api/reminders/{id} | edita, adia ou conclui | usuário dono | campos | lembrete | F04 |
| DELETE /api/reminders/{id} | cancela | usuário dono | — | — | F04 |
| POST /api/push/subscriptions | registra o navegador para push | usuário | inscrição Web Push | — | F04 |
| DELETE /api/push/subscriptions | remove o navegador | usuário | endpoint | — | F04 |

### F01, F10: tarefas e visão do dia

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/tasks | listas de hoje, próximas, atrasadas e quadro | usuário | visão, projeto | tarefas | F01, F10 |
| POST /api/tasks | cria | usuário | título, prazo, prioridade, recorrência | tarefa | F01 |
| PATCH /api/tasks/{id} | edita, move no quadro, conclui | usuário dono | campos | tarefa | F01, F10 |
| DELETE /api/tasks/{id} | arquiva | usuário dono | — | — | F01 |
| GET /api/day | o dia numa linha do tempo: agenda, tarefas, hábitos, lembretes | usuário | data | itens ordenados | F14 |
| GET /api/calendar | calendário unificado por mês ou semana | usuário | período, fontes | itens por dia | F09 |
| POST /api/focus-sessions | começa o modo foco (F2) | usuário | tarefa, minutos | sessão | F01 |
| PATCH /api/focus-sessions/{id} | termina o modo foco (F2) | usuário dono | — | sessão | F01 |

### F07: hábitos

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/habits | hábitos com registros do mês, sequência e recorde | usuário | mês | hábitos e estatísticas | F07 |
| POST /api/habits | cria | usuário | nome, meta, dias, horários | hábito | F07 |
| PATCH /api/habits/{id} | edita ou arquiva | usuário dono | campos | hábito | F07 |
| PUT /api/habits/{id}/logs/{day} | marca feito (idempotente) | usuário dono | valor | registro | F07 |
| DELETE /api/habits/{id}/logs/{day} | desmarca | usuário dono | — | — | F07 |

### F05, F06: finanças

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/finance/summary | entrou, saiu, sobra, patrimônio, previsão e "a resolver" | usuário | mês | resumo | F05 |
| GET /api/transactions | extrato com busca e filtros | usuário | mês, texto, categoria, conta, cartão | lançamentos | F05 |
| POST /api/transactions | lança | usuário | tipo, valor, data, categoria, conta ou cartão | lançamento | F05 |
| PATCH /api/transactions/{id} | edita | usuário dono | campos | lançamento | F05 |
| DELETE /api/transactions/{id} | apaga | usuário dono | — | — | F05 |
| POST /api/transactions/{id}/confirm | previsto vira realizado (F2) | usuário dono | data, conta | lançamento | F05 |
| GET /api/accounts | contas e saldos | usuário | — | contas | F05 |
| POST /api/accounts | cria conta | usuário | nome, saldo inicial | conta | F05 |
| PATCH /api/accounts/{id} | edita ou arquiva | usuário dono | campos | conta | F05 |
| GET /api/categories | categorias | usuário | — | categorias | F05 |
| POST /api/categories | cria | usuário | nome, tipo, pai | categoria | F05 |
| PATCH /api/categories/{id} | edita ou arquiva | usuário dono | campos | categoria | F05 |
| GET /api/cards | cartões, limite usado e faturas (F2) | usuário | — | cartões | F05 |
| POST /api/cards | cria cartão (F2) | usuário | nome, limite, fechamento, vencimento | cartão | F05 |
| PATCH /api/cards/{id} | edita ou arquiva (F2) | usuário dono | campos | cartão | F05 |
| GET /api/cards/{id}/invoices | faturas com itens (F2) | usuário dono | mês | faturas | F05 |
| POST /api/installments | compra parcelada, gera as parcelas (F2) | usuário | descrição, total, nº de parcelas, cartão | compra e parcelas | F05 |
| GET /api/recurrences | recorrências e próximas cobranças (F2) | usuário | — | recorrências | F05 |
| POST /api/recurrences | cria (F2) | usuário | descrição, valor, frequência | recorrência | F05 |
| PATCH /api/recurrences/{id} | edita, pausa ou encerra (F2) | usuário dono | campos | recorrência | F05 |
| POST /api/recurrences/{id}/skip | pula uma cobrança (F2) | usuário dono | data | — | F05 |
| POST /api/imports/statements | lê a foto da fatura e marca o que já foi lançado (F3) | usuário | anexo, cartão | itens | F06 |
| POST /api/imports/statements/{id}/confirm | lança os itens escolhidos (F3) | usuário dono | itens | lançamentos | F06 |

### F09: agenda (F2)

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/integrations/{provider}/connect | inicia o OAuth (Google ou Microsoft) | usuário | — | redirect | F09 |
| GET /api/integrations/{provider}/callback | troca o código por tokens, guarda cifrado, lista calendários | provedor (state assinado) | code, state | redirect | F09 |
| PATCH /api/calendars/{id} | escolhe quais calendários aparecem | usuário dono | selecionado | calendário | F09 |
| DELETE /api/integrations/{id} | desconecta e revoga os tokens | usuário dono | — | — | F09, F18 |
| POST /api/webhooks/google-calendar | aviso de mudança na agenda | Google (token do canal) | cabeçalhos | 200; sincroniza na fila | F09 |
| POST /api/webhooks/microsoft-graph | aviso de mudança no Outlook | Microsoft (clientState) | validação ou eventos | 200 | F09 |

### F10, F11, F12: projetos, metas, conhecimento e automações (F2)

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/projects | projetos com progresso e situação | usuário | status | projetos | F10 |
| POST /api/projects | cria (pode partir de um modelo) | usuário | nome, prazo, orçamento | projeto | F10 |
| PATCH /api/projects/{id} | edita ou arquiva | usuário dono | campos | projeto | F10 |
| POST /api/projects/{id}/milestones | cria marco | usuário dono | título, data | marco | F10 |
| PATCH /api/milestones/{id} | edita ou conclui marco | usuário dono | campos | marco | F10 |
| GET /api/goals | metas com progresso e ritmo | usuário | — | metas | F10 |
| POST /api/goals | cria | usuário | título, alvo, prazo, ligação | meta | F10 |
| PATCH /api/goals/{id} | edita, pausa ou conclui | usuário dono | campos | meta | F10 |
| POST /api/goals/{id}/entries | registra avanço manual | usuário dono | valor | avanço | F10 |
| GET /api/notes | notas por área, caderno ou caixa de entrada | usuário | filtros | notas | F11 |
| POST /api/notes | cria nota | usuário | título, conteúdo, caderno | nota | F11 |
| PATCH /api/notes/{id} | edita, move ou arquiva | usuário dono | campos | nota | F11 |
| GET /api/notebooks | áreas e cadernos | usuário | — | árvore | F11 |
| POST /api/notebooks | cria área ou caderno | usuário | nome, pai | caderno | F11 |
| GET /api/journal | diário por período | usuário | período | entradas | F11 |
| POST /api/journal | escreve no diário | usuário | texto | entrada | F11 |
| GET /api/search | busca por sentido e por texto em notas, diário e conversas | usuário | consulta | resultados | F11 |
| GET /api/automations | lista | usuário | — | automações | F12 |
| POST /api/automations | cria | usuário | quando, fontes, instrução, push | automação | F12 |
| PATCH /api/automations/{id} | edita, pausa ou apaga | usuário dono | campos | automação | F12 |
| POST /api/automations/{id}/preview | roda agora sem entregar e mostra o que leu | usuário dono | — | revisão e fontes | F12 |
| GET /api/automations/{id}/runs | histórico de execuções | usuário dono | — | execuções | F12 |

### F15, F17, F18, F19: assinatura, privacidade e preferências

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| POST /api/billing/checkout | cria a sessão de checkout | usuário logado | plano (mensal ou anual) | URL | F15 |
| POST /api/billing/portal | abre o portal: trocar cartão, cancelar | usuário logado | — | URL | F17 |
| POST /api/webhooks/stripe | eventos de assinatura, idempotente | Stripe (assinatura do webhook) | evento | 200 | F15, F17 |
| GET /api/settings | perfil, assistente, aparência, notificações | usuário | — | perfil | F19 |
| PATCH /api/settings | altera preferências | usuário | campos | perfil | F19 |
| GET /api/memories | o que o assistente lembra (F2) | usuário | — | fatos | F19 |
| DELETE /api/memories/{id} | esquece um fato (F2) | usuário dono | — | — | F19 |
| GET /api/account/export | exporta todos os dados, JSON e anexos (F2) | usuário reautenticado | — | arquivo | F18 |
| POST /api/account/delete-sections | apaga as seções escolhidas (F2) | usuário reautenticado | seções | — | F18 |
| DELETE /api/account | apaga a conta e tudo dela | usuário reautenticado | confirmação | — | F18 |

### F08 e canais extras (F3)

| método e caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| GET /api/health/overview | treino do dia, dieta, peso e medidas | usuário | data | resumo | F08 |
| POST /api/workouts | registra treino e séries | usuário | ficha, séries | treino | F08 |
| POST /api/health/sync | recebe amostras do app nativo (Apple Saúde, Health Connect) | app nativo do usuário | amostras | — | F08 |
| POST /api/webhooks/strava | atividade nova no Strava | Strava (token de verificação) | evento | 200 | F08 |
| POST /api/webhooks/telegram | mensagens do bot | Telegram (token secreto) | atualização | 200 | F02 |

### Jobs (fila QStash, assinatura verificada)

| caminho | faz | disparo | fluxo |
| --- | --- | --- | --- |
| POST /api/jobs/process-inbound | processa mensagem do WhatsApp: baixa mídia, transcreve, roda o agente, responde | webhook do WhatsApp | F02 |
| POST /api/jobs/deliver | envia uma entrega (push, WhatsApp, e-mail) e agenda a próxima ocorrência | horário exato (atraso na fila) | F04, F13, F14 |
| POST /api/jobs/automation-run | executa uma revisão agendada e entrega no chat e no push | horário da automação | F12 |
| POST /api/jobs/index | gera embeddings de notas, diário e mensagens novas | após cada escrita | F11 |
| POST /api/jobs/calendar-sync | sincroniza uma agenda depois de um aviso de mudança | webhook do provedor | F09 |
| POST /api/jobs/delete-account-files | apaga os arquivos do Storage e revoga tokens após a exclusão | exclusão de conta | F18 |

### Varreduras (Vercel Cron)

| caminho | quando (horário de Brasília) | faz | fluxo |
| --- | --- | --- | --- |
| /api/cron/recurrences | todo dia 03:00 | gera os lançamentos previstos dos próximos 60 dias | F05 |
| /api/cron/invoices | todo dia 03:10 | fecha faturas no dia de fechamento e abre a próxima | F05 |
| /api/cron/alerts | a cada hora | avalia avisos: conta a vencer, limite do cartão, renda, projeto parado, próximo mês | F13 |
| /api/cron/habit-nudges | a cada 15 min | hábitos e tarefas que passaram do horário sem registro | F13 |
| /api/cron/briefings | a cada 15 min | agenda o briefing de quem tem horário na próxima janela | F14 |
| /api/cron/calendar-renew | todo dia 04:00 | renova as inscrições de aviso do Google e da Microsoft e faz sincronização de segurança | F09 |
| /api/cron/cleanup | todo dia 04:30 | apaga anexos órfãos e entregas antigas | F18 |

### Chamadas para fora

API da Anthropic (agente); WhatsApp Cloud API (texto, modelos de mensagem, download de
mídia); Web Push; Resend; Google Calendar API e Microsoft Graph (F2); API da Stripe;
provedor de transcrição; provedor de embeddings (F2); QStash (agendar e cancelar).
Só APIs oficiais e públicas, com as suas chaves. Nada do Néctar.

**Contagem:** 109 rotas HTTP (89 de API, 7 webhooks de entrada, 6 jobs, 7 varreduras),
mais 34 ferramentas do assistente.

## As partes que mordem

- **Fusos e horário de verão:** todo instante fica em UTC. "Amanhã às 10h" é resolvido no
  fuso do perfil (`America/Sao_Paulo` por padrão). O Brasil não tem horário de verão desde
  2019, mas usuários em Portugal têm, então recorrências (RRULE) são calculadas no fuso do
  lembrete. Dias de calendário são `date`.
- **Idempotência:** Meta, Stripe e QStash entregam "pelo menos uma vez". As chaves únicas do
  esquema seguram as repetições, e o webhook responde 200 na hora e processa na fila.
- **Corridas:** o saldo é calculado, nunca guardado. O hábito tem um registro por dia. O
  "desfazer" confere se o item mudou depois. A ordem no quadro usa posição fracionária.
- **Limites de taxa:** a Meta limita mensagens seguidas para o mesmo usuário (erro 131056,
  cerca de 1 a cada 6 s), então juntamos a resposta numa mensagem só. A API da Anthropic tem
  limite por organização: fila com nova tentativa e espera crescente. Rate limit por
  usuário no chat.
- **Janela de 24 h do WhatsApp:** fora dela só vão modelos de mensagem aprovados (lembrete,
  briefing, aviso), cobrados por mensagem. Os modelos precisam estar aprovados antes do
  lançamento. `channel_links.last_inbound_at` decide se cabe texto livre.
- **Web Push no iPhone:** só funciona com o PWA instalado na tela inicial (iOS 16.4 ou mais
  novo). No iPhone, o WhatsApp é o canal confiável de lembrete na v1.
- **Tamanho de arquivo:** o upload vai direto ao Storage por URL assinada (não passa pela
  função da Vercel), até 25 MB. A mídia do WhatsApp é baixada no job.
- **Busca:** pgvector (HNSW) mais texto sem acento. O radical em português não junta
  "viagens" e "viagem", por isso a busca por sentido é a principal. Com muitos usuários,
  filtrar por `user_id` junto do índice vetorial exige atenção (busca iterativa do pgvector
  ou particionamento).
- **Realtime:** Supabase Realtime nas tabelas acompanhadas pelas telas, respeitando o RLS.
  Mantém dois aparelhos abertos em sincronia.
- **Offline:** o PWA mostra o último estado em cache e não envia sem rede. Não há fila
  offline na v1.
- **Entregabilidade de e-mail:** domínio próprio com SPF, DKIM e DMARC no Resend.
- **Multiusuário:** FK composta, RLS e `user_id` obrigatório na camada de dados. O teste do
  esquema já cobre um segundo usuário.
- **Exclusão (LGPD):** cascata a partir de `auth.users` (testada); job apaga arquivos e
  revoga tokens; exclusão parcial por seção; exportação; logs com retenção curta;
  política de privacidade lista todos os operadores.
- **Histórico somente-anexar:** qualquer código que reescreva a conversa (cortar mensagens
  antigas, reformatar, trocar a lista de ferramentas no meio) quebra o raciocínio do modelo
  ou causa erro 400. O trigger impede no banco; no código, só anexar.
- **Custo de IA:** cache de prompt, prompt de sistema único, esforço baixo e conversas
  diárias. Medir custo por mensagem desde a fatia vertical e ter limite diário por usuário.
- **Prompt injection:** texto de terceiros (mensagem encaminhada, evento de agenda, página
  da web) não vira instrução. Ação que sai da conta pede confirmação.
- **Verificação do Google:** o escopo de Agenda é sensível. Sem a verificação, só usuários de
  teste conectam. Leva semanas: começar no início da F2.
- **Regras do cartão:** compra no dia do fechamento ou depois cai na fatura seguinte. Dia 31
  em mês curto vira o último dia do mês. Parcelas com centavos sobrando: o resto vai na
  primeira parcela.
- **Moeda:** só BRL na v1. A coluna `currency` existe para Portugal (euro) depois.

## Ordem de construção

### M0: fundação

- **O que entra:** Next.js + Tailwind + shadcn/ui; Supabase com a migração da F1; Auth; layout
  com barra inferior (celular) e lateral (computador); rotas de todas as telas como esboço;
  dados de exemplo realistas.
- **Telas:** S31 e esboços das demais.
- **Tabelas:** todas da F1.
- **Rotas:** callback do Auth.
- **Fora do código, no dia 1:**
  - abrir a conta Meta Business, pedir a verificação da empresa e registrar o número do WhatsApp;
  - criar o projeto no Google Cloud para a verificação OAuth da F2;
  - criar a conta na Stripe e na Anthropic.

### M1: fatia vertical, feia e funcionando

O pedido "gastei 35 na padaria e me lembra do mercado às 18h", feito na web, gera dois
cards com "desfazer". O lembrete aparece em Lembretes, o gasto aparece no Extrato e o
lembrete chega por push às 18h.

- **Telas:** S01, S02, S11 (lista simples), S24 (lista simples), S35.
- **Tabelas:** conversations, messages, actions, reminders, scheduled_deliveries,
  push_subscriptions, accounts, categories, transactions.
- **Rotas:** POST /api/chat, GET /api/chat/history, POST /api/actions/{id}/undo,
  GET e POST /api/reminders, GET /api/transactions, POST /api/push/subscriptions,
  POST /api/jobs/deliver.
- **Ferramentas:** create_reminder, record_transaction, undo_last_action.
- **Prova:** a stack, o agente com ferramentas, a fila e o push. Medir o custo por mensagem aqui.

### M2: obrigatórias (must), fase 1

- **WhatsApp:** S33, F02, F16. Webhook, vínculo, áudio, resposta e lembretes por modelo
  aprovado. Tabelas channel_links e attachments.
- **Voz:** ditado e áudio transcrito no chat. POST /api/uploads e transcribe.
- **Tarefas:** S09 (hoje, próximas, atrasadas, recorrência). Rotas /api/tasks; create_task,
  update_task, query_tasks.
- **Lembretes completos:** recorrência e canais. update_reminder, query_reminders.
- **Hábitos:** S12, F07. Criar, marcar, sequência e recorde. Rotas /api/habits; create_habit,
  log_habit, query_habits.
- **Finanças básicas:** S18 (entrou, saiu, sobra, patrimônio), S24 com busca, categorias e
  contas. /api/finance/summary, /api/accounts, /api/categories; query_finance,
  update_transaction.
- **Visão do dia:** S05. GET /api/day; get_day_overview.
- **Assinatura:** S32, F15, F17. Checkout, portal, webhook da Stripe; app bloqueado sem
  assinatura ativa.
- **Privacidade:** F18, DELETE /api/account.
- **Ao final:** beta fechado com usuários reais.

### M3: importantes (should), fase 2

- **Finanças completas:** S19 a S23, F05 (cartões, faturas, parceladas, recorrências,
  previsão, "a resolver", transferências). Varreduras de recorrências e faturas.
- **Agenda:** S06, S08, F09 (Google e Outlook, vários calendários, evento com convite).
- **Projetos e metas:** S10, S25, F10.
- **Conhecimento:** S26, F11 (notas, áreas, diário, busca por sentido, job de embeddings).
- **Automações:** S27, F12.
- **Avisos proativos:** F13, com a varredura de avisos.
- **Assistente:** briefing (S04, F14), modo de voz (S03, F20), personalização e memória
  (S30, F19), preferências de notificação.
- **Privacidade:** exclusão parcial e exportação.

### M4: opcionais (could), fase 3

- Saúde: S14 a S17, F08.
- Telegram: S34.
- Importação de fatura por foto: F06.
- Apps nativos com Expo: widgets (S36), Apple Watch (S37), Apple Saúde e Health Connect.
- Strava, Alexa (S38), Uber (F21), YouTube.
- Modo foco, teto de gastos, mapa de conexões, modelos de projeto e análises de vários meses.

### M5: correções do `/replica-entrepreneur`

Entram aqui, como linhas novas no `features.csv` (original = no), depois da pesquisa de
avaliações.
