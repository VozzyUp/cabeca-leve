# Paridade com o original

Rodada de 2026-10-08, depois do /replica-test (commit 000a3e2).

## Veredito: ainda não está pronto para vender, mas nada bloqueia

| critério | situação |
| --- | --- |
| obrigatórias (must) | **40 de 40** |
| bugs S1 ou S2 abertos | **nenhum** (9 achados no /replica-test, todos corrigidos) |
| pontuação de funções | **65,2** (precisa de 80 para "pronto para vender") |
| correções do /replica-entrepreneur | **7 de 7** (do F7, falta ligar a Meta, que depende de você) |

Para chegar a 80 faltam cerca de 41 pontos de peso, o equivalente a umas 21 funções "should" completas. Com todas as "should" prontas, a nota vai a 86,3.

**Não dá para medir o layout agora.** As únicas telas do original que temos são as imagens de divulgação da App Store (`replica/screens/`): têm mão, aparelho inclinado, título por cima e outra tela sobreposta. O imgdiff precisa da mesma tela, no mesmo estado e do mesmo tamanho, então essas imagens dariam um número sem sentido.

- **Para medir:** se você tem uma conta no Néctar, tire prints no navegador ou no celular, em 390 × 844, de S02 (conversa), S18 (dinheiro), S09 (tarefas) e S11 (lembretes). Eu comparo com as do clone, que já estão em `replica/clone-screens/`.
- **Mesmo sem medir:** o layout muda de qualquer jeito no /replica-brand, e o que pesa é a função.

## Comportamento: o que a tela não mostra

| fluxo | o original faz | o clone faz | ação |
| --- | --- | --- | --- |
| F01 anotar várias coisas | 2 toques (campo, enviar) | 2 toques (campo, Enter) | manter |
| F02 pelo WhatsApp | 1 toque (mandar o áudio) | 1 toque | manter |
| F15 assinar | compra antes, depois e-mail de ativação; e-mail da compra diferente do cadastro dá "assinatura inválida" (4 avaliações de 1★) | cria a conta, usa 7 dias grátis, assina já logado: não tem como os e-mails divergirem | manter; é argumento de venda |
| F15 testar antes de pagar | sem teste grátis (2 avaliações) | 7 dias grátis sem cartão | manter |
| F17 cancelar | pelo suporte ou pela Hotmart; há relato de cobrança depois de cancelar | um toque em Ajustes; a Asaas para de cobrar na hora; acesso até o fim do período | falta o comprovante (F1) |
| suporte | robô, sem resposta humana (5 avaliações) | não existe ainda | **F3: construir antes de lançar** |
| erro no meio | relatos de "failed" e telas que travam | mensagem clara, campo guarda o texto, sem internet avisa, sessão vencida leva ao login e volta | manter |
| memória entre conversas | lembra preferências e fatos | não lembra (só a conversa do dia) | construir (abaixo) |
| voz | voz própria com orbe animado | voz do navegador | depois; custo de TTS |
| WhatsApp | número oficial (Meta) | UAZAPI agora, com risco de bloqueio | migrar para a Meta antes de crescer |
| excluir dados | total ou por seção | só total | depois |

## Os 5 próximos a construir

**Atualização:** o item 1 (F1 a F3) e o teto de gastos do item 3 já estão feitos. Seguem: avisos proativos, a lista "a resolver" e a transferência entre contas, foto no chat e no WhatsApp, e memória.

Ordem: o que vende (correções das avaliações) primeiro, depois o que mais sobe a nota por esforço.

1. **F1 a F3 do `fixes.md`: cancelar com comprovante, pagamento em confirmação e falar com uma pessoa.** Não entram na nota, porque o original não tem, mas são o posicionamento recomendado e o que torna o clone "melhor que o original". Tamanho: S + S + M.
2. **Avisos proativos (área em 10%).** A varredura de cada minuto já existe; falta usá-la para avisar de conta a vencer 2 dias antes, cartão perto do limite, hábito que passou do horário e renda comprometida. São 4 "should", uma já pela metade. Tamanho: M.
3. **Finanças: teto por categoria (F5), lista "a resolver" e transferência entre contas.** São 3 "should", e o teto é dor citada nas avaliações. A tabela `budgets` já existe. Tamanho: M.
4. **Foto no chat e no WhatsApp (comprovante, fatura).** São 2 "should"; o Claude lê imagem direto. Tamanho: M.
5. **Memória do assistente.** É 1 "should"; a tela de Ajustes já tem o interruptor. Guardar fatos ("recebo dia 5") e mostrar com opção de apagar. Tamanho: M.

Com os itens 2 a 5, a nota vai a cerca de 72. Os 8 pontos que faltam para 80 saem de: lembrete com antecedência, subtarefas, Kanban, metas que avançam sozinhas, revisões agendadas pelo Claude e terminar as "partial" de finanças. Google Agenda e Outlook valem 2 "should", mas dependem da verificação do Google, que leva semanas: comece o pedido cedo.

---

## Parity: 65.2 / 100

features 65.2  (136 counted, must-haves 40 of 40 done)

## By area, weakest first
- telegram                       0.0  (1 features)
- apps nativos                   0.0  (6 features)
- integrações extras             0.0  (2 features)
- avisos proativos              10.0  (7 features)
- automações                    16.7  (4 features)
- agenda                        22.2  (5 features)
- projetos                      28.6  (5 features)
- conhecimento                  40.0  (7 features)
- metas                         50.0  (3 features)
- saúde                         56.2  (8 features)
- notificações                  62.5  (4 features)
- tarefas                       64.3  (6 features)
- privacidade                   66.7  (4 features)
- hábitos                       67.6  (8 features)
- finanças                      69.4  (17 features)
- lembretes                     72.7  (5 features)
- personalização                75.0  (2 features)
- assistente                    79.8  (17 features)
- voz                           83.3  (4 features)
- whatsapp                      88.2  (6 features)
- visão do dia                  90.9  (6 features)
- conta e assinatura            95.8  (9 features)

## Missing, in build order
- [should] agenda: Criar evento com convidados pelo chat, no  (site [conferir])
- [should] agenda: Vários calendários por conta, no  (App Store 3.1)
- [should] assistente: Enviar foto ou documento no chat e usar o conteúdo, no  (App Store 3.0)
- [should] assistente: Histórico da conversa com filtro por dia semana e mês, no  (S02)
- [should] assistente: Memória de preferências e fatos do usuário, no  (site [conferir])
- [should] automações: Revisão entregue no chat com push opcional, no  (envio pela fila (QStash) no /replica-backend; S28 já guarda o que chegou)
- [should] avisos proativos: Aviso de cartão perto do limite, no  (site [conferir])
- [should] avisos proativos: Aviso de renda comprometida, no  (site [conferir])
- [should] conhecimento: Busca por sentido nas notas e conversas, no  (exclusão: índices de busca semântica)
- [should] finanças: Lista 'a resolver' com contas atrasadas e próximas e botão confirmar, no  (S18)
- [should] finanças: Previsão do mês (realizado mais previsto) e projeção do saldo, no  (S18)
- [should] finanças: Transferência entre contas e ajuste de saldo fora de gasto e receita, no  (site [conferir])
- [should] hábitos: Cobrança quando o hábito passa do horário, no  (App Store 3.0: avisos proativos)
- [should] hábitos: Meta por tempo quantidade ou ação simples, no  (site [conferir])
- [should] lembretes: Avisar com antecedência (ex.: 1 dia e 1 hora antes), no  (site [conferir])
- [should] metas: Metas ligadas a hábitos ou projetos que avançam sozinhas, no  (site [conferir])
- [should] privacidade: Excluir só algumas seções dos dados, no  (exclusão de conta)
- [should] tarefas: Quadro Kanban (a fazer fazendo feito), no  (site [conferir])
- [should] tarefas: Subtarefas, no  (Google Play)
- [should] whatsapp: Mandar foto pelo WhatsApp (comprovante ou fatura), no  (site [conferir])
- [should] agenda: Conectar Google Agenda e ver os eventos, partial  (S08: tela e estados conectada/desconectada com eventos de exemplo; OAuth no /replica-backend)
- [should] agenda: Conectar Outlook e ver os eventos, partial  (S08: idem; OAuth da Microsoft no /replica-backend)
- [should] assistente: Indicador das etapas enquanto o assistente trabalha, partial  (passo genérico 'Entendendo o pedido' / 'Ouvindo o áudio'; etapas reais de cada ferramenta exigem streaming)
- [should] automações: Criar revisão agendada com dia hora fontes e instrução, partial  (S27 lista, pausa e descreve; criar pela conversa com o Claude no /replica-backend)
- [should] avisos proativos: Aviso de conta a vencer, partial  (o resumo da manhã (push e WhatsApp) cita as contas dos próximos 3 dias; aviso próprio 2 dias antes, não)
- [should] conta e assinatura: Nota fiscal enviada por e-mail após o pagamento, partial  (emitida pela Asaas (ativar no painel))
- [should] finanças: Cartões de crédito com limite fechamento e vencimento, partial  (S22: limite, fechamento, vencimento, fatura aberta e limite disponível; cadastrar pela conversa depois)
- [should] finanças: Compras parceladas com parcelas pagas e data de quitação, partial  (S21: parcela atual, quanto falta, quitação e previsão de 6 meses; registrar parcelado pela conversa depois)
- [should] finanças: Contas recorrentes e assinaturas com pausar e pular cobrança, partial  (S20: pausar e retomar; avisa quando o dia passou sem pagamento; pular uma cobrança depois)
- [should] notificações: Notificação 'seu dia' mostrando o que vem a seguir, partial  (push e WhatsApp 'Seu dia' de manhã com o resumo; notificação viva do que vem a seguir, não)
- [should] notificações: Preferências de notificação: canais, silêncio e limite por dia, partial  (S29: canais liga/desliga e horário do resumo; silêncio e limite por dia depois)
- [should] personalização: Tom de conversa escolhido ou descrito pelo usuário, partial  (o agente usa o tom e o tamanho escolhidos em S30; tom descrito em texto livre, não)
- [should] privacidade: Desconectar integrações e revogar acessos, partial  (S08 liga e desliga as agendas; revogar tokens de verdade no backend)
- [should] projetos: Marcos com datas, partial  (etapas marcáveis na tela; data por etapa depois)
- [should] projetos: Projetos com tarefas ligadas e barra de progresso, partial  (S10: progresso pelas etapas; ligar tarefas ao projeto depois)
- [should] voz: Modo de voz com resposta falada, partial  (S03: fala vira pedido e a resposta é lida em voz alta, com a voz do navegador)
- [could] agenda: Mover ou editar evento pelo chat, no  (site [conferir])
- [could] apps nativos: App para Apple Watch, no  (App Store 3.0; exige app nativo)
- [could] apps nativos: Apps iOS e Android nas lojas, no  (fora da v1: plataformas escolhidas são web e WhatsApp)
- [could] apps nativos: Captura por voz pelo widget sem abrir o app, no  (exige app nativo)
- [could] apps nativos: Skill da Alexa, no  (site [conferir]; exige certificação da Amazon)
- [could] apps nativos: Treino ao vivo na tela bloqueada, no  (exige app nativo)
- [could] apps nativos: Widgets na tela inicial e bloqueada, no  (App Store 3.0 e 3.1; exige app nativo)
- [could] assistente: Pesquisar um assunto resumir e salvar como nota, no  (site [conferir])
- [could] automações: Histórico de execuções da automação, no  (site [conferir])
- [could] automações: Prévia da revisão antes de salvar, no  (site [conferir])
- [could] avisos proativos: Aviso de aperto previsto para o próximo mês, no  (site [conferir])
- [could] avisos proativos: Aviso de projeto parado, no  (site [conferir])
- [could] avisos proativos: Mensagem de reconhecimento quando o dia fecha com tudo feito, no  (site [conferir])
- [could] avisos proativos: Placar do dia no fim da tarde, no  (site [conferir])
- [could] conhecimento: Caixa de entrada de ideias para revisar depois, no  (site [conferir])
- [could] conhecimento: Mapa de conexões entre ideias, no  (site [conferir])
- [could] conhecimento: Registro de livros e cursos, no  (Google Play)
- [could] conhecimento: Transformar nota em tarefa, no  (site [conferir])
- [could] finanças: Importar fatura ou comprovante por foto sem duplicar, no  (site [conferir])
- [could] finanças: Valores a receber de terceiros, no  (site [conferir])
- [could] hábitos: Cor por hábito, no  (novidades Google Play)
- [could] integrações extras: Buscar e tocar vídeos do YouTube dentro do app, no  (privacidade 6.2)
- [could] integrações extras: Chamar Uber pelo chat com destino pronto, no  (site [conferir])
- [could] lembretes: Marcar lembrete como importante, no  (site [conferir])
- [could] notificações: Despertador para lembretes importantes, no  (App Store 3.0; exige app nativo)
- [could] projetos: Modelos de projeto, no  (exclusão: modelos de projeto)
- [could] projetos: Orçamento do projeto ligado aos gastos, no  (site [conferir])
- [could] projetos: Situação do projeto pelo prazo decorrido (no rumo ou em risco), no  (site [conferir])
- [could] saúde: Conectar Strava e marcar hábitos esportivos sozinho, no  (suporte; privacidade 6.1)
- [could] saúde: Sincronizar treinos passos e sono do Apple Saúde e Health Connect, no  (exige app nativo)
- [could] tarefas: Análise de conclusão por semana, no  (site [conferir])
- [could] telegram: Conversar e receber lembretes pelo Telegram, no  (site [conferir])
- [could] visão do dia: Radar das áreas da vida, no  (site [conferir])
- [could] assistente: Briefing do dia em áudio, partial  (S04: botão Ouvir com a voz do navegador; áudio gerado no servidor depois)
- [could] hábitos: Análise de padrões (melhores dias e ranking), partial  (S13: taxa por dia da semana (90 dias) e melhor e pior dia; ranking entre hábitos depois)
- [could] metas: Ritmo da meta (no ritmo atrás à frente) e pausar, partial  (à frente, no ritmo ou atrás pelo tempo decorrido; pausar depois)
- [could] saúde: Plano de dieta com refeições e metas de macros, partial  (S16: refeições, itens e calorias; macros depois)
- [could] saúde: Registrar refeições e ver calorias e macros do dia, partial  (S14/S16: marcar refeição do plano e calorias do dia; refeição fora do plano depois)
- [could] saúde: Registrar treino série a série com descanso, partial  (S14/S15 marcam o treino do dia; série a série com descanso depois)
- [could] voz: Escolher a voz do assistente, partial  (S30 guarda a escolha; prévia com a voz do navegador)

## Left out on purpose (not scored)
- Marca nome logo orbe e textos do Néctar: pertencem ao original; o /replica-brand cria os seus
- Personas com nomes de personagens de terceiros: marcas de terceiros; crie personas próprias
- Vídeos aulas depoimentos e comunidade: conteúdo e rede do original
- Ofertas vitalícias e promoções de aniversário: decisão comercial deles; a sua sai do /replica-launch
- Venda pela Hotmart (marketplace e afiliados): parceria deles; o clone escolhe o próprio meio de cobrança
- Base de usuários e avaliações: pertencem ao original

## Yours, not in the original (not scored)
- Cancelar com comprovante e conferência de cobrança depois do cancelamento
- Pagamento em confirmação sem bloquear o acesso (nunca 'assinatura inválida')
- Falar com uma pessoa: suporte humano com protocolo e prazo
- Bateria de testes do assistente com pedidos reais (finanças, busca, lembretes)
- Testar aviso agora (push e WhatsApp) e reserva pelo WhatsApp quando o push falha
- Nunca pedir acesso ao WhatsApp da pessoa e dizer isso no cadastro
- Migrar o número do assistente para a API oficial da Meta (modelos aprovados)
