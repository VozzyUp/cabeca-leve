# Mapa de recon: Néctar (web, iOS, Android, WhatsApp)

Escopo: o app inteiro (decisão do usuário). A primeira versão do clone sai na **Web + WhatsApp**.
Para: produto próprio para vender no Brasil (assinatura para pessoa física, em pt-BR).
Data: 2026-10-06

> Este arquivo é material de pesquisa. Nada daqui vai para o produto: nem nomes,
> nem textos, nem imagens do original. O código e os textos do clone são escritos do zero.

## Notas de método

- **Só fontes públicas.** Nenhuma conta do Néctar foi usada. Os Termos de Uso do
  Néctar proíbem o usuário de "realizar engenharia reversa, descompilar ou copiar
  partes do software". Por isso o recon não usa uma conta, mesmo que você assine.
- **Capturas de tela** vêm da página pública da App Store (`replica/screens/appstore-*.png`).
  São referência de layout. Nunca entram no clone.
- **O site é montado por JavaScript** e o navegador desta sessão não conseguiu abri-lo
  (bloqueio de certificado da rede). O que vem do site (suporte, termos, privacidade,
  exclusão de conta, preços, landing) é o texto que essas páginas exibem
  publicamente. Itens marcados **[conferir]** devem ser confirmados navegando no site.
  Nenhum detalhe que só aparece no código foi usado.
- **Vídeos públicos** de demonstração (no site) não foram assistidos. Vale assistir
  e anotar os fluxos antes do `/replica-build`.

## Fontes

| # | fonte | URL | o que deu |
| --- | --- | --- | --- |
| 1 | suporte / FAQ | https://www.meu-nectar.com/suporte | cancelamento no app (acesso até o fim do ciclo); reembolso em 7 dias; assinatura liberada pelo e-mail da compra; vincular WhatsApp no app com mensagem de boas-vindas; Strava em Perfil → Integrações; mesma conta em web, iOS e Android com sincronização em tempo real; nota fiscal por e-mail; "esqueci minha senha" [conferir] |
| 2 | preços | https://www.meu-nectar.com/#pricing | plano único "Personal", sem limite de uso: R$ 49,90/mês ou R$ 399/ano (≈ R$ 33,25/mês); € 14,90/mês em Portugal; 14 dias de garantia; checkout na Hotmart [conferir] |
| 3 | changelog | App Store, "Histórico de versões" (link da linha 4) | 1.0 (24/07/2025) lançamento; 2.0 (29/07/2025) notificações nativas e pelo WhatsApp; 3.0 (31/08/2026) treino e dieta, modo de voz, fotos e documentos, widgets, Outlook e Google Agenda, Apple Saúde, Apple Watch, despertador, avisos proativos, notificações personalizadas; 3.1 (25/09/2026) automações, tema claro, widgets só com pendentes, vários calendários, despertador em lembretes mensais |
| 4 | App Store | https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755 | 3,8★ (53 avaliações); download grátis, assinatura fora da loja; iPhone, iPad, Mac e Apple Watch; 9,9 MB; privacidade: só e-mail vinculado à identidade; 9 capturas de tela |
| 5 | Google Play | https://play.google.com/store/apps/details?id=com.wnapp.id1751730637210&hl=pt_BR | cerca de 3,7★ (111 avaliações); 5 mil+ downloads; atualizado em 23/09/2026; descrição com os "pilares" execução, tarefas (subtarefas, lembretes, observações), finanças (parceladas, assinaturas), hábitos, estudos e biblioteca; novidades da 3.1 |
| 6 | site / landing | https://www.meu-nectar.com/ | posicionamento ("assistente pessoal com IA", "Jarvis"); o loop central (uma mensagem organiza várias áreas); proatividade; personalização (voz, tom, aparência); widgets; integrações (WhatsApp, Telegram, Alexa, Google Agenda, Outlook, Apple Saúde, Health Connect, Strava, Uber, Apple Watch) [conferir] |
| 7 | termos de uso | https://www.meu-nectar.com/termos-de-uso | SaaS por assinatura; trial "quando aplicável"; cancelamento vale no fim do ciclo; IA de terceiros (Google, Anthropic, OpenAI); integrações (Google Calendar, YouTube, Strava, WhatsApp, Hotmart); só para maiores de 18 anos; proíbe engenharia reversa |
| 8 | política de privacidade | https://www.meu-nectar.com/politica-de-privacidade | dados de cadastro (nome, e-mail, WhatsApp, senha, foto); operadores: Supabase, Vercel e Railway; Gemini, Claude e OpenAI; Twilio e/ou 360Dialog (WhatsApp); OneSignal (push); Google Agenda (uso limitado); Strava (leitura e webhook, marca hábitos sozinho); YouTube (busca e player oficial); Apple Saúde e Health Connect (treinos, passos, distância, calorias, sono, frequência cardíaca); retenção de 90 dias após o fim da conta |
| 9 | exclusão de conta | https://www.meu-nectar.com/exclusao-de-conta | exclusão total pelo app, na hora; exclusão parcial por seção; pedido por e-mail em até 30 dias; **lista completa do que é apagado** (é o melhor inventário de entidades que existe; ver "Modelo de dados") |
| 10 | página "vitalício" | https://www.meu-nectar.com/vitalicio | oferta de acesso vitalício; promete integrações futuras (Alexa, Spotify, YouTube, Uber, Apple Fitness, Samsung Fitness), plano Business e contas compartilhadas [conferir] |
| 11 | Hotmart (marketplace) | https://hotmart.com/pt-br/marketplace/produtos/nectar-ai/E99353347G | produto vendido pela Hotmart; nota 1,4 (37 avaliações). Fonte para o `/replica-entrepreneur` |
| 12 | app web | https://app.meu-nectar.com | onde o app roda no navegador (tela de login). Não acessado: sem conta |
| 13 | conta própria | — | não usada (ver Notas de método) |
| 14 | API pública | — | o Néctar não tem API pública documentada |

## Loop central

Você manda uma mensagem (texto, áudio ou foto), no app ou no WhatsApp. O assistente
separa cada pedido, cria ou atualiza o item certo (tarefa, lembrete, gasto, hábito,
nota, evento) e mostra um card de confirmação com "desfazer". Depois, ele volta
sozinho na hora certa: lembrete, aviso proativo ou revisão agendada.

## Navegação observada

- **Celular:** barra inferior com ícones (visão, tarefas, finanças, hábitos, metas…) e
  um botão redondo do assistente à direita (appstore-iphone-2, appstore-iphone-4).
- **Tablet/computador:** barra lateral com chat, visão, tarefas, hábitos, projetos,
  lembretes, finanças, conhecimento, metas e configurações, esta última com um contador
  de notificações (appstore-ipad-1, appstore-ipad-2, appstore-ipad-4).
- Fundo escuro com acentos em azul; tema claro existe desde a 3.1.

## Telas

| ID | tela | como chegar | propósito | componentes principais | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Início do assistente | abrir o app; ícone de chat | ponto de partida: saudação e entrada da conversa | saudação com nome, orbe animado, botão "ver briefing diário", "retomar chat", campo de mensagem com anexar, ditado e modo de voz | preenchido (appstore-iphone-1, appstore-ipad-1); primeiro uso [a ver] |
| S02 | Conversa | S01 → enviar mensagem | pedir, perguntar e confirmar | balões, cards de ação ("lembrete criado", "transação criada") com desfazer e "abrir em…", resposta em texto com destaques, seletor dia/semana/mês | preenchido (appstore-ipad-2, appstore-iphone-2); erro de card, pedido ambíguo [a ver] |
| S03 | Modo de voz | S01/S02 → ícone de onda | conversar falando, com resposta em áudio | orbe, forma de onda, estado "respondendo", botão encerrar | respondendo (appstore-iphone-2); ouvindo, sem permissão de microfone [a ver] |
| S04 | Briefing diário | S01 → "ver briefing diário"; notificação da manhã | resumo do dia: agenda, tarefas, hábitos, contas | texto do resumo, áudio opcional | [a ver] |
| S05 | Visão do dia | barra → olho | o dia inteiro numa tela | data e saudação, contador "10 de 13 em aberto", itens sem horário, relógio "agora", linha do tempo do dia, card "em foco agora" com "começar foco", lista do dia, busca, + | preenchido (appstore-ipad-4, appstore-iphone-4); tarefas atrasadas em destaque |
| S06 | Calendário unificado | S05 → calendário | ver o mês ou a semana com tudo junto | navegação de mês, "hoje", alternar mês/semana, filtros, chips de fonte (agenda, finanças, projeções, outros), pontos por dia | preenchido (appstore-ipad-4) |
| S07 | Modo foco | S05 → "começar foco" | trabalhar num item com tempo marcado | timer, item em foco, aviso sonoro no fim | [a ver] (novidades 3.1: "sino no fim do Modo Foco") |
| S08 | Agenda | S05/S06; chat | eventos do Google Agenda e do Outlook | lista/grade de eventos, vários calendários, criação de evento com convidados pelo chat | [a ver] |
| S09 | Tarefas | barra → tarefas | organizar o que fazer | listas (hoje, próximas, atrasadas), prioridade, prazo, subtarefas, observações, recorrência, quadro Kanban (a fazer, fazendo, feito), taxa de conclusão | [a ver]; vazio [a ver] |
| S10 | Projetos | barra lateral → projetos | acompanhar entregas maiores | lista com progresso e prazo, situação (no rumo, em risco, adiantado), marcos, quadro por status, detalhe com tarefas e orçamento | [a ver] |
| S11 | Lembretes | barra lateral → lembretes; card "abrir em lembretes" | ver e gerenciar avisos | lista por dia, recorrência, antecedência, marcar como importante, canais de entrega | [a ver] |
| S12 | Hábitos | barra → hábitos | rotina e constância | abas resumo, calendário, hábitos, saúde, análise; navegação de mês; cor por hábito | preenchido, aba saúde (appstore-ipad-3) |
| S13 | Detalhe do hábito | S12 → hábito | histórico de um hábito | sequência, recorde, calendário de registros, evolução | [a ver] |
| S14 | Saúde · hoje | S12 → saúde | treino e dieta do dia | treino de hoje, treinos da semana ("2 de 5"), peso atual, sub-abas hoje, treino, dieta, progresso | preenchido (appstore-ipad-3) |
| S15 | Treino | S14 → treino | executar a ficha do dia | lista de exercícios, última execução (carga × repetições), recorde, mapa muscular, botão iniciar, séries e descanso; corrida com distância e ritmo | preenchido (appstore-iphone-3) |
| S16 | Dieta | S14 → dieta | plano alimentar e registro | refeições do plano, metas de calorias e macros (dia de treino ou descanso), totais do dia | [a ver] |
| S17 | Progresso corporal | S14 → progresso | evolução do corpo | chips peso, gordura, cintura, peito, braço, coxa, quadril, "+ registrar"; gráfico de linha; maior valor, número de registros, período; figura masculino/feminino com medidas; histórico | preenchido (appstore-ipad-3) |
| S18 | Finanças · resumo | barra → finanças | o mês num olhar | abas resumo, variáveis, recorrentes, parceladas, contas, análise; navegação de mês; "sai", "entra", "sobra do mês", patrimônio; barras do dia a dia por categoria e média por dia; previsão do mês; lista "a resolver" (atrasadas e próximas, com confirmar); contas e cartões; chave de projeção | preenchido (appstore-ipad-3, appstore-iphone-3) |
| S19 | Finanças · variáveis | S18 → variáveis | gastos do dia a dia | gastos por dia e categoria, ritmo e projeção do mês | [a ver] |
| S20 | Finanças · recorrentes | S18 → recorrentes | assinaturas, contas fixas e entradas fixas | datas de cobrança, pagas e próximas, custo mensal e anual, peso na renda | [a ver] |
| S21 | Finanças · parceladas | S18 → parceladas | compras parceladas | parcelas pagas e restantes, data da última, compromisso mensal | [a ver] |
| S22 | Finanças · contas | S18 → contas | bancos e cartões | saldos, limite, fatura aberta, fechamento e vencimento | parcial (appstore-ipad-3) |
| S23 | Finanças · análise | S18 → análise | padrões de vários meses | fluxo mês a mês, categorias no tempo | [a ver] |
| S24 | Extrato | card → "abrir no extrato" | lista de lançamentos | busca, filtros, ordenação, detalhe do lançamento | [a ver] |
| S25 | Metas | barra → metas | objetivos com progresso | tipos (financeira, hábito, projeto), barra de progresso, ritmo (no ritmo, atrás, à frente), previsão de conclusão, pausar | [a ver] |
| S26 | Conhecimento | barra lateral → conhecimento | notas, diário e ideias | áreas e cadernos, notas, diário, caixa de entrada de ideias, mapa de conexões, busca por sentido | [a ver] |
| S27 | Automações | configurações ou chat [conferir] | revisões agendadas | quando (todo dia, dias da semana, uma vez, hora), fontes (tarefas, projetos, hábitos, metas, finanças), instrução em texto, entrega (chat e push opcional), prévia, histórico de execuções | [a ver] |
| S28 | Central de notificações | ícone de configurações com contador | avisos recebidos | lista de avisos com contador | contador "6" visto (appstore-ipad-2); [palpite] que é uma central |
| S29 | Configurações e perfil | barra lateral → engrenagem | conta e preferências | dados da conta, assinatura (cancelar), número do WhatsApp, integrações, notificações, aparência, exclusão total ou parcial | [a ver] |
| S30 | Personalização do assistente | S29 | jeito do assistente | memória, escolha de voz (com prévia), tom (calmo, sério, animado ou descrito por você), claro ou escuro | [a ver] [conferir] |
| S31 | Login, cadastro e senha | app web sem sessão | entrar | e-mail e senha, "esqueci minha senha", ativação pelo e-mail da compra | [a ver] |
| S32 | Planos e checkout | landing → planos | assinar | mensal e anual, garantia, checkout externo (Hotmart) | [conferir] |
| S33 | Canal WhatsApp | conversa com o número do assistente | usar o assistente sem abrir o app | texto, áudio, foto; boas-vindas ao vincular; lembretes e avisos chegam por lá | [a ver] |
| S34 | Canal Telegram | conversa com o bot | idem WhatsApp | idem | [conferir] |
| S35 | Notificações push | celular ou navegador | lembretes, avisos proativos e "seu dia" | título curto com emoji, prévia, toque abre o item | [a ver] |
| S36 | Widgets | tela inicial e bloqueada (iOS/Android) | o dia sem abrir o app | seu dia, só pendentes, captura por voz, hábitos, treino ao vivo | [a ver] (só nativo) |
| S37 | Apple Watch | relógio | falar ou escrever para o assistente; hábitos e treino | "toque para falar", "escrever" | preenchido (capturas do relógio na App Store, não baixadas) |
| S38 | Alexa | skill na Alexa | perguntar sobre o dia por voz | conversa por voz | [conferir] |

## Fluxos

```
F01 Organizar várias coisas numa mensagem (loop central)
    S01 -> S02 (texto ou ditado: "gastei 35 na padaria e me lembra do mercado às 18h")
        -> cards "lembrete criado" + "transação criada" -> (opcional) desfazer / abrir em…
    cliques no caminho feliz: 2 (tocar no campo, enviar). Número a bater: 2.
    borda: pedido sem valor ou sem hora (perguntar de volta), datas relativas ("amanhã",
           "sexta", "daqui a 5 dias"), fuso, mensagem enviada duas vezes (não duplicar),
           conta ou cartão que não existe, desfazer depois de abrir outra tela

F02 Organizar pelo WhatsApp
    S33 (texto, áudio de 40 s ou foto) -> transcrição -> itens criados -> resposta no WhatsApp
        -> tudo aparece no app (S02, S11, S18…)
    cliques: 1 (enviar o áudio). Número a bater: 1.
    borda: número não vinculado, assinatura vencida, áudio longo com vários pedidos,
           foto de comprovante, aviso fora da janela de 24 h da Meta (exige modelo aprovado)

F03 Perguntar sobre a própria vida
    S02 ("para onde foi meu dinheiro?", "como estão meus hábitos?")
        -> resposta com números + cards (gráfico, lista, progresso) -> abrir em…
    borda: período sem dados, pergunta que cruza áreas (metas + finanças), muitos itens

F04 Lembrete na hora certa
    F01 cria o lembrete -> chega a hora -> push / WhatsApp / despertador -> concluir ou adiar
    borda: fuso, recorrência mensal no dia 31, horário de silêncio, limite diário de avisos,
           lembrete importante, canal desconectado

F05 Lançar e acompanhar dinheiro
    gasto pelo chat (F01) -> S18 (sobra do mês atualizada) -> S24 extrato -> editar
    crédito: a compra cai na fatura (S22); parcelada (S21); recorrente (S20);
    "a resolver": confirmar conta prevista
    borda: crédito x débito (o crédito não tira da conta), parcelas, estorno, transferência
           entre contas (não é gasto), ajuste de saldo, conta atrasada, virada do mês

F06 Importar fatura por foto
    S02 ou S33: foto da fatura -> leitura -> lista de compras -> confirmar -> lança sem
    duplicar o que já existia [conferir]
    borda: foto ruim, fatura de outro mês, parcelas, compras já lançadas

F07 Criar e marcar hábito
    S02 ("quero meditar 10 min todo dia às 8h") -> hábito criado -> S12 -> marcar feito
        -> sequência e constância
    borda: só em alguns dias, meta por tempo ou quantidade, marcar dia anterior, dia de folga,
           quebra de sequência, aviso quando passa do horário

F08 Fazer o treino do dia
    S14 -> S15 -> iniciar -> marcar séries e descanso -> concluir -> recorde e progresso
    borda: trocar exercício, série extra, treino fora do plano, treino vindo do Strava ou
           Apple Saúde marcando o hábito sozinho

F09 Agenda conectada
    S29 -> conectar Google ou Outlook -> eventos em S05, S06, S08
        -> pelo chat: "marca reunião amanhã às 14h e convida paulo@…" -> evento + convite
    borda: vários calendários, conflito de horário, fuso, acesso revogado ou vencido

F10 Projetos e metas
    S02 ("cria o projeto reforma da cozinha com estas etapas…") -> S10 -> tarefas no Kanban
        -> progresso -> meta ligada (S25) avança sozinha
    borda: projeto parado (aviso proativo), prazo vencido, orçamento estourado

F11 Guardar e reencontrar uma ideia
    S02 ("anota o plano da viagem…") -> nota numa área (S26)
        -> semanas depois: "o que eu escrevi sobre a viagem?" -> busca por sentido
    borda: nada encontrado, ideia na caixa de entrada para revisar, transformar nota em tarefa

F12 Revisão agendada (automação)
    S27 -> definir quando, fontes, instrução e canal -> prévia -> salvar
        -> no horário: revisão no chat + push -> histórico de entregas
    borda: nada a revisar, automação pausada, push silenciado

F13 Aviso proativo (sem você pedir)
    algo muda nos dados (cartão a 90% do limite, 70% da renda gasta, projeto parado há
    3 semanas, hábito sem registro 1 h depois do horário, conta vence em 2 dias)
        -> push ou WhatsApp no tom escolhido -> abrir
    borda: avisos demais (limite diário), horário de silêncio, aviso repetido

F14 Briefing do dia
    manhã -> notificação "seu dia" -> S04 (texto ou áudio)

F15 Assinar e entrar
    landing -> S32 planos -> checkout -> e-mail de ativação -> criar senha -> S31 -> S01
    borda: e-mail da compra diferente do cadastro ("assinatura inválida"), e-mail no spam,
           Pix ou boleto pendente

F16 Vincular o WhatsApp
    S29 -> informar número -> mensagem de boas-vindas no WhatsApp -> confirmado
    borda: número já usado, DDI, número sem WhatsApp

F17 Cancelar a assinatura
    S29 -> cancelar -> confirmar -> acesso até o fim do ciclo pago

F18 Excluir conta (total ou parcial)
    S29 -> excluir -> escolher seções (parcial) ou tudo -> confirmar -> sair da conta

F19 Personalizar o assistente
    S30 -> escolher voz (ouvir prévia), tom e aparência -> salvo

F20 Conversar por voz
    S01 -> S03 -> falar -> resposta falada + itens criados -> encerrar e ver a conversa

F21 Chamar um Uber pelo chat
    S02 ("chama um Uber para a padaria mais próxima") -> card com destino
        -> abre o app da Uber com o destino pronto
```

## Componentes

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Navegação principal | barra inferior (celular), barra lateral (tablet/computador) | ativo, com contador | todas |
| Orbe do assistente | grande (início), pequeno (botão da barra) | parado, ouvindo, pensando, respondendo | S01, S03, S05 |
| Campo de mensagem | com anexar, ditado e voz | vazio, digitando, gravando, enviando, desativado (offline) | S01, S02 |
| Balão de mensagem | do usuário, do assistente (com destaques) | enviando, enviado, erro | S02 |
| Card de ação | lembrete, transação, tarefa, hábito, nota, evento | criado, desfeito, concluído (check), erro | S02, S33 |
| Card de dados | lista, progresso, métrica, gráfico por categoria, insight | carregando, preenchido, sem dados | S02, S04, S27 |
| Indicador de etapas | "registrando…", "criando…" | em andamento, concluído, corrigindo | S02 |
| Seletor segmentado | dia/semana/mês; mês/semana; masculino/feminino | selecionado | S02, S06, S17 |
| Abas | finanças, hábitos, saúde | ativa | S12, S14, S18 |
| Navegação de período | ‹ mês ›, hoje | — | S06, S12, S18 |
| Chips | fonte do calendário, tipo de medida, filtros | ligado, desligado | S06, S17, S24 |
| Calendário mensal | com pontos por dia, com "+N" | hoje, selecionado, vazio | S06, S12 |
| Linha do tempo do dia | itens com horário, "agora" | concluído, atrasado, sem horário | S05 |
| Número em destaque (KPI) | dinheiro, peso, relógio | positivo, negativo, previsto | S05, S14, S18 |
| Gráficos | barras empilhadas, linha, barras de previsão | vazio, preenchido | S17, S18, S23 |
| Item de lista com checkbox | tarefa, lembrete, hábito | aberto, feito, atrasado | S05, S09, S11, S12 |
| Lista "a resolver" | atrasadas, próximas | com botão confirmar | S18 |
| Quadro Kanban | colunas a fazer, fazendo, feito | arrastando, vazio | S09, S10 |
| Card "em foco agora" | com botão começar foco | — | S05 |
| Timer de foco | — | rodando, pausado, terminado (som) | S07 |
| Ficha de exercício | séries carga × repetições, recorde, mapa muscular | última vez, em execução, concluída | S15 |
| Figura do corpo | masculino, feminino | com medidas | S17 |
| Botões | primário, secundário, ícone, confirmar, desfazer | normal, foco, carregando, desativado | todas |
| Formulário em folha/modal | tarefa, transação, hábito, lembrete, meta | novo, editar, erro de validação | todas as áreas |
| Aviso (toast) | sucesso, desfazer, erro | — | todas |
| Notificação push | lembrete, aviso proativo, revisão, "seu dia" | — | S35 |
| Estados vazios | "crie seu primeiro…" | — | todas as áreas |

## Modelo de dados inferido

A página de exclusão de conta lista o que é apagado, e essa lista confirma quais
entidades existem (confiança alta). Os campos vêm das capturas e do site.

```
Usuário        nome, e-mail, senha (hash), foto, whatsapp, fuso, idioma, tema
               evidência: privacidade 2.1 e 2.2 · confiança: alta
Assinatura     usuário, plano (mensal | anual), status, e-mail da compra, data da compra,
               fim do ciclo · evidência: suporte, exclusão §5 · confiança: alta
Canal          usuário, tipo (whatsapp | telegram | alexa), identificador, verificado_em
               evidência: suporte (vincular WhatsApp), site · confiança: média
Mensagem       usuário, canal, papel (usuário | assistente), texto, anexos (áudio transcrito,
               imagem, documento), itens criados · evidência: exclusão §4 · confiança: alta
Memória        usuário, fato, origem (conversa) · evidência: site ("lembra de você") · média
Preferências   voz, tom (predefinido ou descrito), aparência, canais, horário de silêncio,
do assistente  limite diário de avisos · evidência: site · confiança: média [conferir]
Tarefa         usuário, título, observações, prazo (dia e hora), prioridade (alta | média | baixa),
               coluna (a fazer | fazendo | feito), projeto, recorrência, subtarefas, concluída_em
               evidência: Google Play, site, appstore-iphone-4 · confiança: alta
Projeto        usuário, nome, status, situação (no rumo | em risco | adiantado), prazo,
               orçamento · evidência: exclusão ("projetos, etapas e modelos de projeto") · alta
Etapa (marco)  projeto, título, data, concluída · evidência: exclusão, site · confiança: média
Modelo de      nome, etapas e tarefas padrão · evidência: exclusão · confiança: média
projeto
Lembrete       usuário, título, quando, recorrência (diária | semanal | mensal), antecedências,
               importante (despertador), canais, status · evidência: exclusão, appstore-ipad-2,
               App Store 3.0 e 3.1 · confiança: alta
Envio agendado referência (lembrete | automação | aviso), canal, enviar_em, status
               evidência: exclusão ("notificações agendadas") · confiança: alta
Hábito         usuário, nome, cor, tipo de meta (tempo | quantidade | simples), alvo, dias da
               semana, horários, ativo · evidência: site, Google Play · confiança: alta
Registro de    hábito, dia, valor, origem (manual | Strava | Apple Saúde | Health Connect),
hábito         fora do plano · evidência: exclusão ("conclusões e histórico de sequências"),
               privacidade 6.1 · confiança: alta
Ficha de       usuário, nome, hábito, sessões (dias da semana), exercícios com séries-alvo
treino         evidência: appstore-iphone-3, site · confiança: média
Série feita    exercício, carga, repetições, data · evidência: appstore-iphone-3
               ("última vez", "recorde") · confiança: média
Dieta          refeições (horário, itens), metas de calorias e macros por tipo de dia
               evidência: site · confiança: média [conferir]
Refeição       data, itens, kcal, proteínas, carboidratos, gorduras · evidência: site · média
registrada
Medida         tipo (peso | gordura | cintura | peito | braço | coxa | quadril), valor, unidade,
corporal       data, origem · evidência: appstore-ipad-3 · confiança: alta
Amostra de     tipo (passos | distância | calorias | sono | frequência cardíaca | treino), valor,
saúde          período, origem · evidência: privacidade 6.3 · confiança: alta
Conta          usuário, nome, banco, saldo · evidência: exclusão, appstore-ipad-3 · alta
Cartão         usuário, nome, banco, limite, dia de fechamento, dia de vencimento
               evidência: exclusão, site · confiança: alta
Fatura         cartão, mês, total, fecha_em, vence_em, paga · evidência: appstore-ipad-3
               ("fatura venceu há 3 dias") · confiança: média
Lançamento     usuário, tipo (despesa | receita | transferência | ajuste), valor (centavos),
               data, descrição, categoria, subcategoria, meio (pix | débito | crédito | boleto),
               conta ou cartão, status (realizado | previsto | atrasado), recorrente,
               parcelamento · evidência: appstore-ipad-2, appstore-iphone-2, exclusão · alta
Compra         descrição, valor total, nº de parcelas, valor da parcela, primeira parcela,
parcelada      cartão · evidência: exclusão, aba "parceladas", novidades 3.1 · confiança: alta
Recorrência    descrição, valor, frequência, dia, categoria, tipo (assinatura | conta fixa |
               entrada), ativa ou pausada · evidência: exclusão, aba "recorrentes" · alta
Categoria      nome, cor, categoria-mãe · evidência: cards ("alimentação", "transporte") · média
Teto de gasto  categoria, valor, período · evidência: avaliação na App Store citando
               "tetos de gastos" · confiança: palpite
Meta           usuário, tipo (financeira | hábito | projeto), alvo, valor atual, prazo,
               ligação (conta | hábito | projeto), status (ativa | pausada)
               evidência: exclusão, site · confiança: média
Nota           usuário, título, conteúdo, área/caderno, ligações, origem (texto | voz)
               evidência: exclusão ("blocos de conhecimento"), site · confiança: média
Área/caderno   usuário, nome · evidência: site · confiança: média
Diário         usuário, data, texto · evidência: exclusão · confiança: alta
Índice de      referência ao conteúdo, vetor · evidência: exclusão ("índices de busca
busca          semântica") · confiança: alta
Integração     usuário, provedor (google | outlook | strava), tokens, escopos, calendários
               escolhidos · evidência: exclusão ("autorizações") · confiança: alta
Evento em      integração, calendário, título, início, fim, dia inteiro, participantes
cache          evidência: exclusão ("eventos de agenda em cache") · confiança: alta
Automação      usuário, título, frequência (diária | dias da semana | uma vez), dias, hora,
               fontes, janela em dias, instrução, canais (chat, push), ativa
               evidência: App Store 3.1, Google Play, site · confiança: média
Execução de    automação, executada_em, status (entregue | não lida | sem nada | falhou),
automação      mensagem · evidência: site · confiança: média
Regra de aviso tipo (limite do cartão | renda comprometida | projeto parado | hábito atrasado |
proativo       conta a vencer | aperto no próximo mês), limiar, último envio
               evidência: site · confiança: palpite (os avisos existem; a estrutura é palpite)
Dispositivo    usuário, plataforma, token de push · evidência: privacidade (OneSignal) · média
```

Relações: Usuário 1-n tudo. Projeto 1-n Tarefa e 1-n Etapa. Hábito 1-n Registro e 0-1 Ficha
de treino. Cartão 1-n Fatura 1-n Lançamento. Compra parcelada 1-n Lançamento. Recorrência 1-n
Lançamento. Meta n-1 (Conta | Hábito | Projeto). Automação 1-n Execução 1-1 Mensagem.
Mensagem 1-n itens criados (para o "desfazer").

## Matriz de funcionalidades

Ver `features.csv`: 142 funcionalidades. Must: 40, should: 49, could: 47, skip: 6.

Critério: com a primeira versão na Web + WhatsApp, "must" é o loop central e o básico de
cada área; "should" completa as áreas; "could" é refinamento ou depende de app nativo.

## Fora do escopo (não pode ou não deve ser clonado)

- **A marca Néctar:** nome, logo, orbe, frases, roteiros das respostas. O `/replica-brand`
  cria tudo isso do zero.
- **Personas com nomes de terceiros:** o Néctar oferece tons com nomes de personagens da
  Marvel. São marcas de terceiros; o clone cria personas próprias.
- **Conteúdo e rede deles:** vídeos, aulas, depoimentos, avaliações, a comunidade e o grupo
  VIP, a figura do fundador como rosto da marca, a base de usuários.
- **Decisões comerciais:** ofertas vitalícias, promoções de aniversário e a parceria com a
  Hotmart. O seu modelo de cobrança sai do `/replica-launch`.
- **Open Finance:** anunciado pelo Néctar, ainda não lançado. Exige um parceiro regulado
  (agregador autorizado). Pode virar um diferencial seu depois, não é paridade.
- **Dependem de aprovação de terceiros (clonáveis, mas com fila):** WhatsApp Business
  (verificação da empresa e modelos de mensagem aprovados pela Meta), escopo de Agenda do
  Google (verificação OAuth leva semanas), Microsoft Graph, Strava (acordo de API),
  Apple Saúde e Health Connect (exigem app nativo e revisão das lojas), skill da Alexa
  (certificação da Amazon).

## Tamanho

Telas 38 (contando canais e superfícies como WhatsApp, push e widgets), fluxos 21,
entidades 39.

Partes difíceis:

1. **Assistente confiável:** um modelo de IA com ferramentas que separa vários pedidos numa
   mensagem, entende datas relativas em português, não duplica, pergunta quando falta
   informação e permite desfazer. Precisa de testes de avaliação contínuos.
2. **WhatsApp oficial (Meta):** verificação da empresa, modelos aprovados para avisos fora
   da janela de 24 h, custo por conversa, áudio e foto.
3. **Agendamento e avisos em escala:** lembretes recorrentes, fusos, silêncio e limite
   diário, filas com nova tentativa, regras de aviso financeiro.
4. **Finanças de cartão:** fatura (fechamento e vencimento), parcelas, recorrências e
   previsão. Muita regra e muito caso de borda.
5. **Integrações OAuth:** Google Agenda (verificação do Google), Outlook, Strava.
6. **Voz:** transcrição de áudio e modo de voz com pouca demora.
7. **Busca por sentido e memória:** embeddings e o que o assistente "lembra".
8. **LGPD:** exclusão total e parcial, portabilidade, operadores listados.

Tamanho: **XL** para o app inteiro, ou seja, precisa ser dividido em fases. Sugestão:

- **Fase 1 (M, algumas semanas):** loop central na web e no WhatsApp: chat e áudio,
  tarefas, lembretes, hábitos, finanças básicas, visão do dia, notificações, assinatura.
- **Fase 2 (L, um trimestre):** finanças completas (cartões, faturas, parcelas,
  recorrências, previsão), agendas Google e Outlook, projetos, metas, conhecimento,
  automações, avisos proativos, modo de voz.
- **Fase 3 (L):** saúde (treino, dieta, medidas), apps iOS e Android, widgets, relógio,
  Alexa, Telegram, Strava e Apple Saúde.

Sem promessa de clone perfeito: o `/replica-diff` mede a paridade com números.
