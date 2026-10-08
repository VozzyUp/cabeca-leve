# Registro de construção

| tela | data | estado | o que falta | mais difícil do que parecia |
| --- | --- | --- | --- | --- |
| shell | 2026-10-07 | feito | — | as 32 telas do mapa têm rota (29 em esboço); navegação por links com trilho lateral (computador) e barra inferior com "Mais" (celular) |
| S01 início da conversa | 2026-10-07 | parcial | briefing do dia (M3), nome do usuário (depende do login) | — |
| S02 conversa | 2026-10-07 | parcial | Claude no lugar do intérprete de regras; streaming; anexos e voz | regex com `\b` não reconhece "às" e "amanhã" em JavaScript: trocado por limites Unicode; o campo fixo cobria a última mensagem no celular |
| S11 lembretes | 2026-10-07 | parcial | criar e editar pela tela, recorrência, canais (M2) | — |
| S24 extrato | 2026-10-07 | parcial | filtros por conta, cartão e período; editar lançamento (M2) | `cn` sem merge deixava padding dobrado; o tailwind-merge descartava `text-label` e `text-metric` até registrá-los como tamanho de fonte |
| S35 aviso de lembrete | 2026-10-07 | parcial | push com o app fechado (Web Push + QStash) e WhatsApp, no /replica-backend | — |
| S09 tarefas | 2026-10-07 | parcial | observações, subtarefas, recorrência, editar (M2/M3) | as caixas só mudavam depois da resposta do servidor: agora mudam na hora e voltam se der erro |
| S12 hábitos | 2026-10-07 | parcial | marcar dias anteriores, calendário do mês, editar e arquivar | sequência que respeita dias não planejados (testada) |
| S18 dinheiro | 2026-10-07 | parcial | previsão do mês, "a resolver", contas e cartões (M3) | o CSS `capitalize` deixava "Outubro De 2026": maiúscula agora só na primeira letra |
| S05 meu dia | 2026-10-07 | parcial | compromissos da agenda (M3), modo foco | — |
| banco provisório | 2026-10-07 | — | — | um teste parecia mostrar perda de dados; medindo, era a 1ª chamada de rota compilando em dev (~600 ms) e o teste navegando antes da resposta. O banco provisório passou a gravar em `.data/fake-db.json` (sobrevive a reinícios) e os testes esperam a confirmação |
| banco provisório (M3/M4) | 2026-10-07 | — | — | 6 meses de histórico gerados com semente fixa (capturas e testes estáveis); arquivos antigos de `.data/` são completados sozinhos. Telas novas leem no servidor (`lib/server.ts`) e gravam por ações de servidor (`app/actions.ts`), sempre pelo mesmo DataStore |
| S19 gastos do dia a dia | 2026-10-07 | feito | — | variável = gasto sem fixo ligado; a comparação com o mês anterior usa o mesmo período, não o mês inteiro |
| S20 fixos | 2026-10-07 | parcial | pular uma cobrança, editar | o aluguel do dia 5 aparecia "vence 5 de nov." sem ter sido pago em outubro: agora avisa que o dia passou sem pagamento |
| S21 parcelas | 2026-10-07 | parcial | registrar parcelado pela conversa | arredondamento: a última parcela absorve os centavos que sobram |
| S22 contas e cartões | 2026-10-07 | parcial | cadastrar contas e cartões | ciclo da fatura depende de hoje estar antes ou depois do fechamento; dois números grandes lado a lado estouravam no celular |
| S23 análise | 2026-10-07 | feito | — | — |
| S10 projetos | 2026-10-07 | parcial | tarefas ligadas, datas por etapa, criar pela tela | — |
| S25 metas | 2026-10-07 | parcial | pausar, metas ligadas a hábitos | o ritmo compara o avanço com o tempo decorrido (5 pontos de folga); no celular o cartão estourava a largura: grade sem `grid-cols-1` cresce até o conteúdo mínimo |
| S26 notas | 2026-10-07 | parcial | editar e apagar, busca por sentido (embeddings no backend) | — |
| S27 revisões agendadas | 2026-10-07 | parcial | criar e editar (pela conversa), envio pela fila | — |
| S28 avisos | 2026-10-07 | feito | — | no celular, a hora à direita espremia o texto: foi para baixo do aviso |
| S05 meu dia (+agenda) | 2026-10-07 | feito | — | compromissos entram como itens com horário; o card "a seguir" só oferece foco para hábito, não para compromisso |
| S04 resumo do dia | 2026-10-07 | parcial | envio no horário, texto no tom escolhido (Claude) | contas "dos próximos 3 dias" usam a próxima ocorrência, que vira o mês quando o dia já passou |
| S06 calendário | 2026-10-07 | feito | — | foco do teclado precisa seguir o dia depois de redesenhar a grade (requestAnimationFrame) |
| S07 modo foco | 2026-10-07 | feito | — | o tempo vem da hora de término, não de somar tiques: o intervalo atrasa com a aba em segundo plano |
| S08 agenda | 2026-10-07 | parcial | OAuth do Google e da Microsoft | — |
| S13 detalhe do hábito | 2026-10-07 | feito | — | taxa de 30 dias não conta hoje ainda em aberto nem dias antes de o hábito existir |
| S14 saúde | 2026-10-07 | parcial | passos e sono (exige app nativo) | — |
| S15 treino | 2026-10-07 | parcial | registrar série a série com descanso | — |
| S16 dieta | 2026-10-07 | parcial | macros, refeição fora do plano, foto do prato | um texto só para leitor de tela (`sr-only`, posição absoluta) dentro de tabela rolável vazava e criava rolagem na página: a célula precisa ser `relative` |
| S17 progresso do corpo | 2026-10-07 | feito | — | — |
| S29 ajustes | 2026-10-07 | parcial | sair, cancelar assinatura, silêncio e limite de avisos | o Chromium tem `SpeechRecognition` sem prefixo: o simulador dos testes precisou cobrir os dois nomes |
| S30 jeito do assistente | 2026-10-07 | parcial | lista do que a memória guardou (backend) | `Segmented` esticava numa coluna flex: agora tem `w-fit` |
| S31 entrar | 2026-10-07 | parcial | autenticação de verdade (Supabase Auth) | — |
| S32 planos | 2026-10-07 | parcial | checkout e liberação automática do acesso | preços provisórios em `lib/plans.ts` até o /replica-entrepreneur |
| S03 conversa por voz | 2026-10-07 | parcial | transcrição no servidor (funciona em qualquer navegador e no WhatsApp) | — |

Fatia vertical (M1) verificada de ponta a ponta no navegador: "gastei 35 na padaria e me lembra
do mercado às 18h" cria dois cards, desfazer tira o lembrete da tela de Lembretes, o gasto aparece
no Extrato e um lembrete marcado para o minuto seguinte avisa no horário.

**Provisório até o /replica-backend:** banco em arquivo (`lib/data/fake-store.ts` grava em `.data/fake-db.json`;
`npm run reset:data` volta aos exemplos) e intérprete de regras (`lib/assistant/rule-parser.ts`). As telas, as rotas e as
ferramentas (`lib/assistant/tools.ts`) já são as definitivas.

**Fim do /replica-build (2026-10-07):** as 32 telas do mapa estão construídas com dados de exemplo
(nenhuma em esboço). Paridade 37,9/100 (era 17,4); 10 de 40 obrigatórias completas e quase todas as
outras parciais. O que falta nelas depende do backend: Claude no lugar do intérprete de regras, login e
assinatura, WhatsApp, áudio, push com o app fechado, OAuth das agendas e envio das revisões pela fila.
Verificação no navegador: `scripts/slice-check.cjs`, `scripts/m2-check.cjs` e `scripts/m3-check.cjs`
(grupos financas, organizacao, plano, saude, conta e exclusao), em 1440 e 390 px, sem erros no console.


## /replica-backend (2026-10-08)

| parte | estado | o que falta | mais difícil do que parecia |
| --- | --- | --- | --- |
| banco e login | feito | Realtime entre aparelhos | apagar uma conta com conversa falhava: o gatilho que limpa o índice de busca rodava com o papel do Auth, sem permissão. Só apareceu porque os testes apagam os usuários no fim; corrigido com `security definer` |
| agente Claude | feito | streaming da resposta, memória | a resposta final nem sempre volta em `runner.params.messages`; o turno com erro precisa ser fechado com uma resposta, senão a próxima mensagem quebra o histórico (uma mensagem de sistema não pode ficar seguida de outra do usuário) |
| WhatsApp | feito (UAZAPI) | modelos de mensagem da Meta | celulares do Brasil chegam do WhatsApp sem o 9; a UAZAPI não assina o webhook (segredo na URL + token da instância no corpo) |
| entregas | feito | revisões agendadas com Claude | duas varreduras ao mesmo tempo mandariam em dobro: reserva com chave única antes de enviar |
| cobrança | feito (sandbox) | — | o checkout recorrente da Asaas só aceita cartão: anual virou pagamento único por Pix ou cartão; a assinatura nasce com id provisório e recebe o real no SUBSCRIPTION_CREATED |

Paridade 57,5/100 (era 37,9); 32 de 40 obrigatórias completas. Detalhes, passo a passo das contas e
checklist de segurança em `replica/backend.md`.

## As 8 obrigatórias que faltavam (2026-10-08)

| item | estado | mais difícil do que parecia |
| --- | --- | --- |
| lembretes recorrentes | feito | "todo dia 5" é mensal e "todo dia" é diário: a ordem das regras importa; o recorrente guarda hora e minuto locais, e ocorrências perdidas com o app desligado não se acumulam |
| tarefas recorrentes | feito | concluir, reabrir e concluir de novo não pode criar duas próximas |
| editar e apagar pela conversa | feito | as ferramentas estritas não aceitam limites de número e tamanho no esquema, e o SDK os mandava: a API recusaria todas as chamadas só com a chave real. O esquema agora sai limpo e o Zod confere no servidor |
| mesma conta em vários aparelhos | feito | o canal do Realtime se inscrevia antes de o token carregar, como anônimo, e o RLS escondia tudo |
| categorias e subcategorias | feito | arquivar a de cima leva as de baixo; os lançamentos antigos mantêm a categoria |
| extrato com filtros | feito | — |
| observações na tarefa | feito | — |
| áudio no app | feito | — |

Paridade 63,2/100; **40 de 40 obrigatórias completas**.


## 2026-10-08: /replica-entrepreneur

- Avaliações: 36 do original (33 da App Store pelo feed oficial da Apple e 3 visíveis no Google Play) e 130 de concorrentes (Zapia 124, Meu Assessor IA 6). Reddit e Reclame Aqui bloquearam o acesso (403). O HN não tem menções.
- Temas em português em `replica/themes-ptbr.json`. Relatórios em `feedback.md` e `feedback-categoria.md`. Plano em `fixes.md` (F1 a F7). Sete linhas novas no `features.csv` e o teto de gastos subiu para should.
- Posicionamento recomendado: "o assistente que responde quando você precisa" (suporte, cobrança e acesso são 12 de 36 avaliações).

## 2026-10-08: /replica-test

- Plano em `replica/test-plan.md`: 63 casos (48 de ponta a ponta, 9 de integração, 2 de unidade, 1 pelo script do navegador e 3 manuais), mais uma lista manual de 7 itens para quando as chaves entrarem. São 48 testes no Playwright (`e2e/`, computador e celular).
- Toda spec falha com erro de console ou resposta 5xx. O axe passa em todas as telas.
- Para o WhatsApp e a cobrança, um servidor falso da UAZAPI e da Asaas (`e2e/mock-server.mjs`); os e-mails chegam no Mailpit do Supabase local.
- 9 bugs em `replica/bugs.md`, todos corrigidos com teste: 1 S1 (redirecionamento aberto no login), 2 S2 (mensagens simultâneas perdidas; conversa presa nas 500 mais antigas), 5 S3, 1 S4.
- O que foi mais difícil do que parecia: o dev server compila cada página na primeira visita e, com 3 testes em paralelo, passava de 10 s. O tempo de espera subiu para 20 s, e isso revelou o BUG-005.
- O F01-N1 achou três bugs em sequência. Cada correção deixou o teste mais exigente: primeiro em série, depois em paralelo, depois repetido. A disputa pela posição das mensagens só aparece com várias chegando ao mesmo tempo, que é justamente o uso no WhatsApp.
