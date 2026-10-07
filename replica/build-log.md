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

