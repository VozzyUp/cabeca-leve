# Registro de construção

| tela | data | estado | o que falta | mais difícil do que parecia |
| --- | --- | --- | --- | --- |
| shell | 2026-10-07 | feito | — | as 32 telas do mapa têm rota (29 em esboço); navegação por links com trilho lateral (computador) e barra inferior com "Mais" (celular) |
| S01 início da conversa | 2026-10-07 | parcial | briefing do dia (M3), nome do usuário (depende do login) | — |
| S02 conversa | 2026-10-07 | parcial | Claude no lugar do intérprete de regras; streaming; anexos e voz | regex com `\b` não reconhece "às" e "amanhã" em JavaScript: trocado por limites Unicode; o campo fixo cobria a última mensagem no celular |
| S11 lembretes | 2026-10-07 | parcial | criar e editar pela tela, recorrência, canais (M2) | — |
| S24 extrato | 2026-10-07 | parcial | filtros por conta, cartão e período; editar lançamento (M2) | `cn` sem merge deixava padding dobrado; o tailwind-merge descartava `text-label` e `text-metric` até registrá-los como tamanho de fonte |
| S35 aviso de lembrete | 2026-10-07 | parcial | push com o app fechado (Web Push + QStash) e WhatsApp, no /replica-backend | — |

Fatia vertical (M1) verificada de ponta a ponta no navegador: "gastei 35 na padaria e me lembra
do mercado às 18h" cria dois cards, desfazer tira o lembrete da tela de Lembretes, o gasto aparece
no Extrato e um lembrete marcado para o minuto seguinte avisa no horário.

**Provisório até o /replica-backend:** banco em memória (`lib/data/fake-store.ts`, some ao reiniciar
o servidor) e intérprete de regras (`lib/assistant/rule-parser.ts`). As telas, as rotas e as
ferramentas (`lib/assistant/tools.ts`) já são as definitivas.
