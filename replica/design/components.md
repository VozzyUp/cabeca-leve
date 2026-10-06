# Componentes

Especificação do sistema visual. Os papéis vêm de `replica/recon.md` (seção Componentes); os
valores, de `tokens.json`. Todo texto é escrito do zero, em pt-BR. Ícones: Lucide (ISC).
Fontes: Inter e JetBrains Mono (OFL).

Vitrine em código: `app/design/page.tsx` (rota `/design`). Capturas em `replica/design/screens/`.
Os componentes **construídos** já estão em `components/ui/`. Os marcados **(build)** são
especificados aqui e construídos junto com a tela que os usa.

Regras gerais:

- **Cores:** só por papel (`bg-surface`, `text-muted`), nunca hex.
- **Foco:** anel de 2px em `focus` com folga de 2px, em tudo que é clicável.
- **Movimento:** respeita `prefers-reduced-motion`.
- **Alvos de toque:** no mínimo 40px no celular (botões `md`, itens de lista, abas da barra).
- **Números:** valores e horários em JetBrains Mono com dígitos tabulares (`text-metric` ou `font-mono`).

## Construídos

```
Button  (components/ui/button.tsx)
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px
  states    default, hover, active, focus-visible, disabled, loading (spinner + rótulo mantido)
  tokens    primary: bg accent / text on-accent; radius md; font sm/600
  a11y      <button type="button">; aria-busy no loading; rótulo sempre presente
  used on   todas

IconButton
  sizes     sm 32, md 40, lg 48 (redondo)
  states    default, hover, disabled; contador opcional (até "9+")
  a11y      aria-label obrigatório; o contador entra no rótulo ("Avisos (4 novas)")
  used on   S01, S02, S05, S28

Card / SectionLabel  (card.tsx)
  tokens    bg surface, borda border, radius lg, sombra card, padding 16
  used on   todas as áreas

ActionCard  (action-card.tsx): o card que o assistente devolve por item criado
  parts     rótulo ("Gasto salvo"), título, valor em destaque (mono), linha de detalhes,
            rodapé com "Desfazer" e "Ver em…"
  states    created (check verde), undone (riscado, 60%), error (borda danger, "Não deu para salvar")
  tones     valor neutral | income (verde) | expense (vermelho)
  a11y      <article> com aria-label "Gasto salvo: Almoço"; botões reais no rodapé
  used on   S02, S33 (versão em texto no WhatsApp)

Message / Steps  (message.tsx)
  variants  usuário (balão surface-2, à direita), assistente (texto corrido, à esquerda)
  states    sending (60%), error ("Não enviada. Toque para tentar de novo.")
  Steps     lista ao vivo (aria-live="polite") das etapas: em andamento (ponto pulsando) e feita
  a11y      prefixo invisível "Você:" / "Assistente:" para leitor de tela
  used on   S02, S03

Composer  (composer.tsx)
  parts     anexar, campo de texto (cresce até 160px), ditar, conversar por voz; enviar aparece
            quando há texto
  states    vazio, digitando, enviando (bloqueado), offline (desativado, "Sem conexão")
  keys      Enter envia, Shift+Enter quebra linha
  a11y      label oculto "Mensagem para o assistente"; todos os botões com nome
  used on   S01, S02

Field  (field.tsx)
  states    default, focus, error (borda danger + mensagem), hint, disabled
  a11y      <label for>, aria-invalid, aria-describedby apontando para erro ou dica
  used on   formulários de todas as áreas, S29, S31

Chip  (chip.tsx)
  states    off, on (borda accent, fundo surface-3), hover, focus
  a11y      aria-pressed
  used on   S06 (fontes do calendário), S17 (tipo de medida), S24 (filtros)

Segmented  (segmented.tsx)
  a11y      radiogroup; setas ← → trocam a opção; só a opção ativa entra no Tab
  used on   S02 (dia/semana/mês), S06 (mês/semana), S17, ajustes de tema

Tabs  (tabs.tsx)
  a11y      padrão WAI-ARIA de abas: setas, Home, End; painel ligado por aria-controls
  overflow  rola na horizontal no celular
  used on   S12 (resumo, calendário, hábitos, saúde, análise), S14, S18 a S23

Metric / Progress / CheckItem / EmptyState / Toast  (data.tsx)
  Metric     rótulo (label), valor (text-metric), dica; tons neutral, income, expense
  Progress   role=progressbar com valor e máximo; texto do valor à direita em mono
  CheckItem  checkbox nativo; estados aberto, feito (riscado), atrasado ("Atrasado · …" em warning)
  EmptyState ícone, título, texto que ensina o que fazer na conversa, ação opcional
  Toast      role=status; ação opcional ("Desfazer"); some em 5 s (no build)
  used on    S05, S09, S11, S12, S18, S25 e todos os estados vazios

NavRail / BottomNav  (nav.tsx)
  computador (lg+)  trilho de 72px só com ícones; title e aria-label; aria-current na seção;
                    ajustes no pé, com ponto de aviso
  celular           barra flutuante de 64px: Meu dia, Tarefas, [Conversa], Dinheiro, Hábitos;
                    o botão central abre a conversa; as outras seções ficam em "Mais" (build)
  used on           todas
```

## A construir junto com as telas (build)

```
Timeline do dia (S05)
  eixo de horas com marcador "agora"; itens com horário (compromisso, tarefa, hábito, lembrete)
  estados  feito, atrasado, sem horário (lista à parte); vazio "Dia livre"
  a11y     também como lista ordenada por horário (o gráfico é aria-hidden)

Calendário mensal (S06, S12)
  grade de 7 colunas, pontos coloridos por fonte e "+N"; hoje e dia selecionado em destaque
  a11y     grid com setas para navegar entre dias; cada dia anuncia "3 itens"

Quadro Kanban (S09, S10)
  colunas A fazer, Fazendo, Feito; arrastar com mouse e toque
  a11y     alternativa por teclado e menu "Mover para…" em cada cartão

Gráficos (S17, S18, S19, S23): barras empilhadas por dia e categoria, linha (peso), barras de previsão
  sempre com tabela equivalente acessível e legenda em texto; cores por papel (income, expense, info)

Lista "a resolver" (S18)
  atrasadas e próximas, valor em mono, botão "Confirmar pagamento"

Folha / modal de formulário (todas as áreas)
  celular: folha de baixo para cima; computador: modal centrado
  a11y     foco preso dentro, Esc fecha, foco volta ao botão que abriu

Notificação push (S35)
  título curto, prévia de uma linha; o toque abre o item

Ficha de exercício (S15) e figura de medidas (S17)
  séries "carga × repetições", recorde, botão "Começar"; figura própria (não traçar a do original)

Timer de foco (S07)
  tempo restante em mono grande, pausar, terminar; som no fim (respeita silêncio do aparelho)
```

## O que não veio do original

- Nada de logo, orbe animado, ilustrações, fotos ou sons do original. O botão do assistente
  usa um ícone comum, e a identidade visual vem do `/replica-brand`.
- A cor de destaque é **neutra e provisória**. A azul do original está anotada em
  `tokens.json._measured` só para o varredor do `/replica-brand` impedir que ela volte.
- Todos os textos de interface foram escritos do zero.
