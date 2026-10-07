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

Fatia vertical (M1) verificada de ponta a ponta no navegador: "gastei 35 na padaria e me lembra
do mercado às 18h" cria dois cards, desfazer tira o lembrete da tela de Lembretes, o gasto aparece
no Extrato e um lembrete marcado para o minuto seguinte avisa no horário.

**Provisório até o /replica-backend:** banco em arquivo (`lib/data/fake-store.ts` grava em `.data/fake-db.json`;
`npm run reset:data` volta aos exemplos) e intérprete de regras (`lib/assistant/rule-parser.ts`). As telas, as rotas e as
ferramentas (`lib/assistant/tools.ts`) já são as definitivas.
