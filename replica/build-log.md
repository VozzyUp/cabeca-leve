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

## 2026-10-08: /replica-diff

- Paridade 64,5 (antes 63,2): 40 de 40 obrigatórias e nenhum bug S1 ou S2 aberto. Ainda abaixo de 80, então não está pronto para vender.
- Linhas atualizadas no `features.csv` com o que o backend já entrega: o resumo da manhã com os lembretes, o "Seu dia" por push e WhatsApp, o tom usado pelo agente e o indicador de etapa.
- O layout não foi medido: só há as imagens de divulgação da App Store. A comparação de comportamento está em `parity.md`.

## 2026-10-08: /replica-brand

- Nome de trabalho **Cabeça Leve**, aplicado em `lib/brand.ts`, nas notificações, nos e-mails e na cobrança. As checagens de INPI e WIPO ficaram a rodar (`brand.md`).
- Paleta laranja (#fb923c no tema escuro, #c2410c no claro) sobre neutros quentes, sem nenhuma falha AA nos dois temas. Os links também passaram para o laranja, porque o azul lembrava o original.
- Voz "leve, direta, presente", com as 10 frases mais vistas revisadas. O código das telas (S01…) saiu da vista.
- Sweep limpo. "Nectar" sem acento fica fora do sweep, porque casa com "conectar"; essa grafia é conferida por palavra inteira.
- Os testes voltaram a passar depois da marca: 48 de ponta a ponta, 25 de integração e 46 de unidade.

## 2026-10-08: F1 a F3 do fixes.md

- **F1, cancelar com comprovante:** ao cancelar, a pessoa recebe protocolo `CL-XXXXXX`, aviso no app e e-mail pela Resend, e o comprovante fica em Ajustes. Se a Asaas cobrar um período que começa depois do cancelamento, o webhook pede o estorno, avisa a pessoa e não estende o acesso.
- **F2, pagamento em confirmação:** voltar da página de pagamento libera o app por até 2 h enquanto o webhook não chega. A tela de obrigado acompanha ao vivo até mostrar "Plano ativo". Abrir essa página sem ter pago não libera nada.
- **F3, falar com uma pessoa:**
  - o chamado nasce em Ajustes, na conversa ou no WhatsApp ("quero falar com uma pessoa"), e funciona mesmo com o teste vencido;
  - tem protocolo e prazo de 1 dia útil, e o time recebe aviso por e-mail e WhatsApp;
  - o time responde em `/suporte/painel` (só `ADMIN_EMAILS` entra), e a resposta chega pelo app, pelo WhatsApp e por e-mail;
  - o agente ganhou a ferramenta `open_support_ticket` e nunca finge ser o suporte.
- Migração `20261008000700_confianca.sql`. `npm run db:types` agora só troca o arquivo de tipos se a geração der certo: um reinício do ambiente tinha zerado o arquivo.
- Testes: `e2e/confianca.spec.ts` (6) e um teste de unidade dos pedidos por uma pessoa. Bateria completa: 54 de ponta a ponta, 25 de integração e 47 de unidade.

## 2026-10-08: F5 a F7 do fixes.md

- **F5, teto de gastos:**
  - card "Tetos do mês" em Dinheiro, com barra acessível, quanto foi e quanto falta;
  - definir pela tela ou pela conversa ("teto de 500 em alimentação", "teto de 400 no ifood"), e o agente ganhou `set_budget`;
  - o gasto que cruza 80% ou 100% avisa no card, no WhatsApp e em Avisos, uma vez cada;
  - a soma inclui as subcategorias e vem sempre do banco.
- **F6, testar aviso:** botão Testar em Ajustes, que mostra o resultado no aparelho, no WhatsApp e no app.
- **F7, seu WhatsApp fica intacto:**
  - a promessa aparece no cadastro, nos Ajustes e nas dúvidas dos planos;
  - na Meta, as mensagens que a pessoa não pediu (lembrete, resumo, aviso, resposta do suporte) saem por modelo aprovado fora da janela de 24 h e por texto livre dentro dela.
- Paridade 65,2, com as 7 correções feitas. Do F7, falta só criar os modelos na Meta.

## 2026-10-08: produção na VPS (Portainer) com o banco no Supabase

- **Configuração lida na hora de rodar:** antes, a URL e a chave do Supabase, o endereço do site e a chave do push ficavam gravados no build (`NEXT_PUBLIC_*`). Agora o navegador recebe esses valores de `/env.js`, e uma única imagem serve para qualquer ambiente. Ficam em `lib/public-env.ts`.
- **Arquivos novos:**
  - `Dockerfile` (standalone, Node 22, sem root, checagem de saúde em `/api/health`);
  - a Action `imagem`, que publica no GHCR;
  - dois stacks do Portainer: Swarm com Traefik e um simples;
  - `deploy/stack.env.example` e o passo a passo em `replica/deploy-vps.md`.
- **O QStash saiu:** na VPS, o serviço `varredura` chama `/api/cron/sweep` a cada minuto.
- **Testado aqui:**
  - a imagem rodando só com variáveis de ambiente, saudável e sem root;
  - login, conversa e tempo real entre dois aparelhos no navegador;
  - o stack simples completo com `docker compose` (app e varredura).
- **Bugs que o teste do container pegou antes da VPS:**
  - o `.dockerignore` excluía `scripts/`, e o build falhava;
  - a checagem de saúde tinha a porta fixa;
  - o `<script>` da configuração estava fora do lugar, e o React reclamava. A bateria de 60 testes pegou esse.

## 2026-10-09: produção na VPS, painel de admin, custo da IA e as áreas que só existiam como tela

- **Configuração pelo app (`/admin/configuracoes`):** as chaves dos serviços ficam no banco, criptografadas com `APP_SECRET_KEY`, e valem na hora. O stack só leva 7 valores de base.
- **Atualização automática:** a Action aplica as migrações novas, monta a imagem e avisa o Portainer.
- **Defeitos de produção que os testes não pegaram (a API real recusa o que a simulada aceita):** 22 ferramentas em modo estrito (limite 20), parâmetros nulos demais (limite 16), gramática grande demais; resolvido tirando o modo estrito (o Zod valida). Lembrete concluído não reabria (o banco exige data no ativo): a data agora fica guardada. Leitura de configuração que se juntava a outra em andamento: agora entra em fila.
- **Modelo e nível do assistente escolhidos na tela** (Haiku 5.5, Sonnet 5.5 ou Opus 5.5; padrão Sonnet no nível médio) e **Custo da IA por usuário e por modelo** (`/admin/custos`), com o uso somado de todas as chamadas de cada mensagem.
- **Áreas que só existiam como tela, agora completas:** o chat cria ficha de treino, plano alimentar, projeto com etapas, meta (dinheiro ou contagem) e peso, marca etapa, treino e refeição como feitos, soma progresso e remove (10 ferramentas novas; desfazer de cada criação devolve a ficha ou o plano de antes). Os cards seguem a ordem do pedido.
- **Revisões agendadas de verdade:** `create_automation` no chat; a varredura de cada minuto monta o texto com os dados da pessoa (tarefas, projetos, hábitos, metas, dinheiro, notas), entrega nos Avisos e por push, WhatsApp ou e-mail, registra cada execução e o custo, pula a que passou de 3 h de atraso e nunca roda duas vezes o mesmo horário. Limite de 10 ativas por pessoa.
- **Foto no chat e no WhatsApp:** a foto é reduzida a 1280 px no servidor (sharp), sem metadados, vai junto da mensagem para o Claude e fica no histórico do dia; depois de 2 dias vira "[foto removida]" (única exceção ao histórico somente-anexar, por função própria).
- **Fica para depois:** Google Agenda e Outlook (login no Google e na Microsoft, tokens, sincronização), avisos proativos, memória, PDF no chat.
- **Migrações novas:** `20261009000100_custo_ia` e `20261009000200_fotos` (arquivos 21 e 22 para colar no SQL Editor).

## 2026-10-09 (à noite): botões no WhatsApp, memória e "a resolver"

- **Botões no WhatsApp:** as respostas do assistente saem com botões quando ajudam. O que acabou de ser registrado leva **Desfazer** e **Alterar** (Alterar volta para a conversa como se a pessoa tivesse pedido a mudança). Lembrete leva **Feito** e **Adiar** (10 minutos, 1 hora ou amanhã às 9h; o adiamento é um lembrete novo, para a repetição do original não mudar de horário). O assistente também escolhe **respostas rápidas** (`suggest_replies`, até 3, 20 caracteres) quando faz uma pergunta curta, como "débito ou crédito?". UAZAPI pelo `/send/menu` (formato atual ou antigo) e Meta pela mensagem interativa. Se o envio dos botões falhar ou estiverem desligados (Configuração do sistema > WhatsApp > Botões), vai só o texto, e o "Testar aviso agora" manda botões de teste. Cada toque vale uma vez por mensagem e só alcança o que é da própria pessoa.
- **Memória do assistente:** `remember` guarda fatos ditos pela pessoa (nunca o que veio de foto ou mensagem encaminhada, para ninguém plantar instruções), os fatos entram no começo do dia como dados, ficam listados em Ajustes com "Esquecer" e "Esquecer tudo", no máximo 100, e saem na exportação de dados. Dois pedidos iguais no mesmo turno ficam em um.
- **A resolver (Dinheiro):** contas fixas e entradas esperadas que venceram sem lançamento ou vencem em 7 dias. "Paguei" e "Recebi" lançam no vencimento, com o valor combinado, uma vez só (dois toques juntos não duplicam). Conta cadastrada hoje não nasce atrasada, a menos que a pessoa diga que este mês ainda está em aberto. A tela de Fixos prometia cadastro pelo chat que não existia: agora existe (`create_recurring`).


## 2026-10-09 (noite): limites por plano, páginas legais e página inicial

- **Limites de uso por plano** (`lib/limits.ts`): mensagens por dia no teste e nos planos pagos, mais um teto de custo de IA por pessoa por dia (soma do `ai_usage` do dia, com a tabela de preços do app). Tudo configurável em Admin > Configurações. O limite por minuto (12) continua. Substitui o limite fixo de 400 mensagens em 24 h; o dia agora vai da meia-noite à meia-noite do fuso da pessoa. A página de planos deixou de prometer "sem limite de mensagens".
- **Páginas legais** `/privacidade` e `/termos` (`lib/legal.ts`), públicas, com a empresa e o contato vindos da configuração. Cobrem: dados tratados, bases legais, fornecedores (Supabase, Anthropic, Groq, WhatsApp, Asaas, Resend), fotos apagadas em 2 dias, direitos da LGPD, cancelamento com comprovante, arrependimento de 7 dias, IA que pode errar e não substitui profissional. Links no rodapé, no cadastro e em Ajustes. **São uma base: peça a revisão de um advogado antes de cobrar.**
- **Página inicial** (`/`) para quem não entrou: título, exemplo de conversa, funções, como começa, preço e botão de teste grátis; sem depoimentos inventados. Quem já entrou segue para a conversa.
- **Teste de aviso** não falha por inteiro se o push der erro; mostra o detalhe técnico de cada canal.

## 2026-10-10: navegação mais simples e configuração inicial

- **Barra de cima em todas as telas logadas:** "Voltar" à esquerda (no celular, em tudo que não é aba da barra inferior; no computador, nas páginas de detalhe), e à direita o sino de **Avisos** com contador, o botão de **tema claro/escuro** e o **menu da conta** (Ajustes, Jeito do assistente, Assinatura, Falar com uma pessoa, Refazer a configuração inicial e **Sair**). Voltar volta de verdade quando houve tela anterior; quem entrou direto pelo link sobe um nível.
- **Menu lateral do computador com nomes**, em grupos (principal, Organização, Saúde e rotina), e agora com Saúde, Modo foco e Revisões, que só existiam no celular.
- **Tela "Tudo" do celular em grupos** (Organização, Dinheiro, Saúde e rotina, Conta) em vez de uma lista de 28 itens.
- **Configuração inicial** para conta nova: nome e jeito de conversar (com exemplo de cada tom), WhatsApp (com o código de confirmação), notificações e resumo da manhã, e exemplos do que pedir. Fechar em qualquer passo conta como feito; dá para refazer pelo menu da conta. Contas antigas não veem (migração `20261010000100_boas_vindas`, arquivo 23).
- **Limpeza:** Avisos saiu de Ajustes (está no sino), o botão do Telegram sumiu (não existia de verdade), links "← Ajustes" e "← Hábitos" trocados pelo Voltar da barra.

## 2026-10-10: o tom do assistente de verdade e o tom "Sem filtro"

- **Defeito:** o tom, o tamanho das respostas e a memória só entravam na primeira mensagem do dia. Quem trocava o tom em Ajustes continuava com o antigo até o dia seguinte. Agora o contexto é conferido a cada mensagem e, se mudou, entra de novo ("Preferências atualizadas agora"). Sem mudança, não repete (o cache continua valendo). Fato novo da memória também passa a valer na hora.
- **Tons mais marcados** (descrição de como cada um soa) e regra no prompt: seguir sempre o tom mais recente, inclusive nas confirmações.
- **Tom "Sem filtro"**: o amigo sincerão que zoa, cobra e pode soltar palavrão leve, nunca contra a pessoa. Em qualquer tom: nada sobre corpo, peso, aparência ou saúde, e se a pessoa estiver mal, acolhe.
- **Termômetro do gasto** (`lib/domain/pulse.ts`): ao registrar um gasto, o resultado da ferramenta traz sinais já calculados (categoria 30% acima do mesmo período do mês passado, 5 ou mais lançamentos na semana, muitas assinaturas ou caras). O assistente comenta em uma frase, no tom escolhido, só quando há sinal.
- Escolha do tom em cartões com exemplo (Ajustes e configuração inicial). Migração `20261010000200_tom_sem_filtro` (arquivo 24).
