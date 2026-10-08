# Plano de testes: assistente pessoal (clone)

Data: 2026-10-08. Ambiente: local, contas novas criadas por teste. As dependências rodam assim:

- **Supabase** local (`npm run db:start`).
- **Servidor:** `npm run dev`.
- **UAZAPI e Asaas:** servidor falso (`e2e/mock-server.mjs`).
- **Agente:** sem chave da Anthropic, a conversa usa o intérprete de regras.

Como rodar:

```bash
npm run db:start
npx playwright test            # ponta a ponta: sobe o dev server e o servidor falso sozinho
npm test                       # unidade
npm run test:int               # integração (banco, agente com API falsa, WhatsApp, entregas, cobrança)
```

Toda spec falha se houver:

- erro de console;
- erro na página;
- qualquer resposta 5xx.

Além disso:

- `telas.spec.ts` passa o axe (WCAG 2.1 A e AA) em todas as 32 telas e confere que nenhuma rola para o lado no celular (Pixel 7, 412 px).
- Os casos marcados com @celular também rodam no celular.

Coluna "auto":

- **e2e** = Playwright (`e2e/`);
- **int** = Vitest com o Supabase local;
- **unid** = Vitest;
- **manual** = precisa de chave ou aparelho real (lista no fim).

## F01 Organizar várias coisas numa mensagem

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | feliz | "gastei 35 na padaria e me lembra do mercado às 18h" | 2 cards; "Ver no extrato" abre o extrato com o gasto; o lembrete aparece em Lembretes; axe sem violações | e2e (computador e celular) | passou |
| F01-H2 | feliz | gasto pela conversa → Desfazer no card | card "desfeito"; some do extrato | e2e | passou |
| F01-E1 | borda: vazio | campo vazio ou só espaços, Enter | nada é enviado; sem botão Enviar | e2e | passou |
| F01-E2 | borda: duplo envio | o mesmo envio duas vezes ao mesmo tempo | um lançamento só | e2e | passou |
| F01-E3 | borda: acentos e emoji | "gastei 12,50 no café ☕ da Conceição" | descrição inteira, com emoji | e2e | passou |
| F01-E4 | borda: texto longo | 4001 caracteres | 400 "Mensagem longa demais" | e2e | passou |
| F01-E5 | borda: pedido sem sentido | "como você está?" | resposta com exemplos | e2e | passou |
| F01-E6 | borda: recarregar | mandar e recarregar | conversa e cards continuam | e2e | passou |
| F01-E7 | borda: sem internet | digitar e desligar a rede | campo bloqueado com "Sem conexão", texto guardado; volta e envia | e2e | passou |
| F01-N1 | negativo: abuso | 12 mensagens em paralelo + 1 pela tela no mesmo minuto | aviso "Muitas mensagens…" e a mensagem continua na tela | e2e | **falhou → BUG-001, BUG-007 e BUG-009, corrigidos** |
| F01-E9 | borda: histórico longo | 520 mensagens gravadas + uma nova | a nova é a última da conversa | int | **falhou → BUG-008, corrigido** |
| F01-E8 | borda: datas relativas | "amanhã às 10h", "sexta", "todo dia 5", horário que já passou | data certa no fuso de Brasília | unid (`rule-parser.test.ts`) | passou |

## F02 e F16 WhatsApp

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F16-H1 | feliz | Ajustes → número → Vincular → código mandado pelo WhatsApp | código de 6 dígitos e link wa.me; "Pronto!" no WhatsApp; Ajustes mostra "Vinculado" | e2e | passou |
| F02-H1 | feliz | "gastei 27,90 no uber" pelo WhatsApp | resposta "Lançamento … R$ 27,90"; aparece no extrato do app | e2e | passou |
| F02-E1 | borda: reenvio | o provedor manda a mesma mensagem de novo | grava uma vez | e2e | passou |
| F02-E2 | borda: eco e grupo | mensagem do próprio número e de grupo | ignoradas, sem resposta | e2e | passou |
| F02-E5 | borda: rajada | 5 mensagens de uma vez pelo WhatsApp | 5 lançamentos e 5 respostas, pergunta e resposta intercaladas | e2e + int | **falhou → BUG-007, corrigido** |
| F02-E3 | borda: áudio | áudio do WhatsApp | transcrito e processado | int | passou |
| F02-E4 | borda: número sem o 9 | o número chega sem o nono dígito | vincula mesmo assim | int | passou |
| F16-N1 | negativo | código errado | não vincula; segue "Aguardando confirmação" | e2e | passou |
| F02-N1 | negativo | número que não é de ninguém | explica como vincular | e2e | passou |
| F02-N2 | negativo | webhook sem o segredo ou com outro token | 401 | e2e | passou |
| F02-N3 | negativo | teste vencido e sem plano | explica e não roda o assistente | int | passou |

## F03 Perguntar sobre a própria vida (agente)

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F03-H1 | feliz | "quanto gastei hoje?" depois de um gasto | o pedido leva o histórico do dia igual ao anterior e a resposta chega | int (API falsa) | passou |
| F03-E1 | borda | apagar um lançamento pela conversa | consulta o id e apaga | int | passou |
| F03-N1 | negativo | a API da Anthropic falha | resposta de desculpas; histórico continua válido | int | passou |
| F03-M1 | qualidade | 50 pedidos reais em português com a chave verdadeira | ver lista manual | manual | pendente (sem chave) |

## F04 Lembrete na hora certa

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F04-H1 | feliz | lembrete vencido + varredura duas vezes | 1 mensagem no WhatsApp; aparece em Avisos | e2e | passou |
| F04-E1 | borda: repetição | lembrete diário dispara | continua ativo, +24 h | e2e | passou |
| F04-E2 | borda: fuso | aparelho em Tóquio, conta em São Paulo | mostra 08:00 de Brasília | e2e | passou |
| F04-E3 | feliz: pela tela | dia + hora + Criar; Apagar | aparece e some | e2e | **falhou sob carga → BUG-005, corrigido** |
| F04-E4 | borda: dia 31 | "todo mês no dia 31" em mês de 30 dias | vai para o último dia | unid (`recurrence.test.ts`) | passou |
| F04-N1 | negativo | varredura sem o segredo | 401 | e2e | passou |
| F04-M1 | aparelho | push com o app fechado (Android e iPhone instalado) | notificação chega | manual | pendente (VAPID) |

## F05 Dinheiro

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F05-H1 | feliz | salário 3000 + mercado 120 no Pix | Entrou 3.000, Saiu 120, Sobra 2.880, Saldo 2.880; "Próximo mês" bloqueado; mês anterior vazio | e2e (computador e celular) | passou |
| F05-E1 | borda: crédito | com cartão cadastrado, "gastei 200 no cartão de crédito" | entra em Saiu; o saldo da conta não muda | e2e | passou |
| F05-E2 | borda: filtro | extrato → Entrou | só entradas | e2e | passou |
| F05-E3 | borda: categoria-mãe | filtrar por Alimentação inclui Padaria | sim | navegador (`scripts/musts-check.cjs`) | passou |

## F07 Hábitos

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F07-H1 | feliz | "quero meditar todo dia às 7h" → Marcar hoje → recarregar → desmarcar | Feito, sequência 1; desmarcado volta | e2e | passou |
| F07-E1 | borda: dias da semana | hábito só em outro dia | "folga hoje" | e2e | passou |

## F11 Notas

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F11-H1 | feliz | salvar e buscar "tiradentes"; buscar "praia" | acha; "Nada encontrado" | e2e | passou |
| F11-E1 | negativo | salvar vazia | aviso, nada salvo | e2e | passou |

## F15 Assinar e entrar · F17 Cancelar

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F15-H1 | feliz | criar conta → e-mail (Mailpit) → link | entra no app; "Teste grátis até…" | e2e | passou |
| F15-H2 | feliz | Planos → Assinar no cartão → página da Asaas (interceptada) → webhooks pago, assinatura e pagamento | Ajustes: "Plano mensal · renova em…" | e2e | passou |
| F17-H1 | feliz | Cancelar assinatura | Asaas recebe DELETE; "vale até…, sem renovar"; botão some | e2e | passou |
| F15-E1 | borda: sessão expirada | apagar cookies | API 401; a tela vai para o login e volta para onde estava | e2e | passou |
| F15-E3 | borda: sessão vence com a tela aberta | apagar cookies em /tarefas e clicar em Adicionar | vai para o login e volta para /tarefas | e2e | **falhou → BUG-006, corrigido** |
| F15-E2 | borda: teste vencido | mandar mensagem | explica e não grava o lançamento | e2e | passou |
| F15-N1 | negativo | senha errada | "E-mail ou senha incorretos." | e2e | passou |
| F15-N2 | negativo: segurança | `voltar=//evil`, `/\evil`, `https://evil` | fica no app | e2e + unid | **falhou com `/\evil` → BUG-002, corrigido** |
| F15-N3 | negativo | webhook da Asaas sem o token | 401 | e2e | passou |
| F15-N4 | negativo | evento repetido da Asaas | ignorado (idempotente) | int | passou |
| F15-M1 | pagamento real | sandbox da Asaas: cartão recusado, Pix pago, Pix vencido | ver lista manual | manual | pendente (chave) |

## Confiança: F1 a F3 do fixes.md

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F17-H2 | feliz | assinar → Cancelar assinatura → a Asaas cobra o mês seguinte mesmo assim | aviso e e-mail com protocolo CL-…; Ajustes mostra o comprovante; a cobrança nova é estornada sozinha e o período não aumenta | e2e | passou |
| F15-E4 | borda: pagou e o webhook atrasou | teste vencido → checkout → volta para /planos/obrigado | "Confirmando o pagamento…"; a conversa funciona; Ajustes diz "Pagamento em confirmação"; quando a Asaas confirma, "Plano ativo" | e2e | passou |
| F15-N5 | negativo: abuso | abrir /planos/obrigado sem ter aberto pagamento | nada é liberado | e2e | passou |
| F3-H1 | feliz | Ajustes → Falar com uma pessoa → mensagem; o time responde no painel | protocolo e prazo; o time recebe e-mail e WhatsApp; a resposta aparece no app e chega por e-mail | e2e | passou |
| F3-E1 | borda | "quero falar com uma pessoa" na conversa, com o teste vencido | abre o chamado e responde com o protocolo | e2e | passou |
| F3-N1 | negativo: segurança | conta comum abre /suporte/painel | página não encontrada | e2e | passou |
| F3-U1 | unidade | jeitos de pedir uma pessoa, e frases parecidas que não são pedido | reconhece só os pedidos | unid | passou |

## Correções F5 a F7

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F5-H1 | feliz | teto de 100 em Alimentação pela tela → gastos de 85, 20 e 5 pela conversa | aviso no card ao cruzar 80% e ao passar de 100%, uma vez cada; Avisos; barra com 110% e "passou R$ 10,00"; tirar o teto | e2e | passou |
| F5-H2 | feliz | "teto de 300 no transporte", "teto de 400 no ifood", categoria inexistente | grava 300 em Transporte e 400 em Alimentação; explica quando não acha | e2e | passou |
| F5-N1 | negativo: segurança | teto em categoria de entrada, de outra conta ou com valor negativo | 404, 404, 400 | e2e | passou |
| F5-U1 | unidade | soma com subcategorias, só do mês e só gastos; níveis; aviso só ao cruzar | correto | unid | passou |
| F6-H1 | feliz | Ajustes → Testar, com WhatsApp vinculado | resultado por canal; mensagem no WhatsApp; aviso em Avisos | e2e | passou |
| F6-E1 | borda | Testar sem WhatsApp | explica como vincular | e2e | passou |
| F7-H1 | feliz | cadastro, planos (dúvidas) e Ajustes | a promessa sobre o WhatsApp aparece nos três | e2e | passou |
| F7-U1 | unidade | Meta: mensagem que a pessoa não pediu, dentro e fora da janela de 24 h | texto livre dentro; modelo aprovado fora, com variáveis numa linha; erro claro sem modelo | unid | passou |

## F18 Excluir · F19 Personalizar

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| F18-H1 | feliz | digitar "excluir" → Excluir tudo | usuário apagado; vai para /entrar | e2e | passou |
| F18-E1 | borda: outro aparelho | o outro aparelho navega depois | vai para o login, sem erro 500 | e2e | passou |
| F18-E2 | borda: tudo junto | a exclusão leva conversa, notas e embeddings | apagados em cascata | int | passou |
| F19-H1 | feliz | tom Divertido + tema Claro → recarregar | continuam marcados | e2e | passou |

## Transversais

| caso | tipo | passos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- |
| X-H1 | acessibilidade e celular | 30 telas do app com conta nova | sem violações do axe, sem rolagem lateral, um h1 por tela | e2e (computador e celular) | **falhou no calendário → BUG-003, corrigido** |
| X-H2 | acessibilidade | /entrar e /planos | sem violações | e2e | passou |
| X-N1 | segurança: outra conta | a segunda conta tenta ler e alterar pelas telas, pela API e direto no Supabase com a chave pública | não vê nada; 404; RLS bloqueia | e2e | passou |
| X-E1 | só teclado | criar, editar (Esc devolve o foco) e concluir uma tarefa | funciona | e2e | passou |
| X-E2 | dois aparelhos | conversa no computador, celular em Tarefas | aparece sem recarregar | e2e | passou |
| X-E3 | duas abas | tempo real recarrega o histórico no meio de um envio | sem mensagens duplicadas | e2e (F01-H1 no celular) | **falhou → BUG-004, corrigido** |

## Fora desta rodada

- **Não construídos na v1:** F06 (fatura por foto), F09 (conectar Google ou Outlook), F21 (Uber) e a parte automática de F12 e F13.
- **Testados só pelas telas** (X-H1): F08 (treino), F10 (projetos e metas), F14 (resumo do dia) e F20 (voz).

## Lista manual (quando as chaves entrarem)

1. **E-mail de verdade (Resend):** cadastro, nova senha e troca de e-mail chegam na caixa de entrada do Gmail e do Outlook, e não no spam. Os links abrem no celular.
2. **Asaas sandbox:**
   - mensal no cartão aprovado;
   - cartão recusado (número de teste da Asaas): a pessoa continua no teste e nada é liberado;
   - anual no Pix pago e no Pix vencido;
   - cancelar e conferir no painel que a assinatura sumiu.
3. **UAZAPI real:**
   - vincular um número pessoal;
   - texto, áudio de 40 s com dois pedidos e foto;
   - lembrete chegando no horário.
4. **Push:** Android Chrome e iPhone com o app instalado na tela inicial, com o app fechado.
5. **Anthropic:** os 50 pedidos reais da F4 do `fixes.md`. Conferir valores, datas, "apaga o último gasto" e perguntas sobre o mês.
6. **Groq:** ditado no Safari do iPhone, que não tem reconhecimento de voz.
7. **Visual:** passar as 32 telas no tema claro e no escuro, no iPhone SE (375 px).
