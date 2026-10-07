// Inventário de telas (IDs de replica/recon.md) com a rota de cada uma no clone.
// S33 a S38 são canais e superfícies (WhatsApp, Telegram, push, widgets, relógio, Alexa): sem rota.

export type Screen = { id: string; path: string; title: string; purpose: string; milestone: "M1" | "M2" | "M3" | "M4" };

export const screens: Screen[] = [
  { id: "S01", path: "/conversa", title: "Conversa", purpose: "Pedir, perguntar e confirmar com o assistente.", milestone: "M1" },
  { id: "S03", path: "/conversa/voz", title: "Conversa por voz", purpose: "Falar com o assistente e ouvir a resposta.", milestone: "M3" },
  { id: "S04", path: "/briefing", title: "Resumo do dia", purpose: "Agenda, tarefas, hábitos e contas do dia, num texto curto.", milestone: "M3" },
  { id: "S05", path: "/dia", title: "Meu dia", purpose: "Tudo que tem hora hoje, numa linha do tempo.", milestone: "M2" },
  { id: "S06", path: "/dia/calendario", title: "Calendário", purpose: "O mês ou a semana com todas as fontes juntas.", milestone: "M3" },
  { id: "S07", path: "/foco", title: "Modo foco", purpose: "Trabalhar num item com tempo marcado.", milestone: "M4" },
  { id: "S08", path: "/agenda", title: "Agenda", purpose: "Eventos do Google Agenda e do Outlook.", milestone: "M3" },
  { id: "S09", path: "/tarefas", title: "Tarefas", purpose: "O que fazer: hoje, próximas, atrasadas e quadro.", milestone: "M2" },
  { id: "S10", path: "/projetos", title: "Projetos", purpose: "Entregas maiores, com marcos e progresso.", milestone: "M3" },
  { id: "S11", path: "/lembretes", title: "Lembretes", purpose: "Avisos com dia e hora.", milestone: "M1" },
  { id: "S12", path: "/habitos", title: "Hábitos", purpose: "Rotina, constância e sequências.", milestone: "M2" },
  { id: "S13", path: "/habitos/exemplo", title: "Detalhe do hábito", purpose: "Histórico, sequência e recorde de um hábito.", milestone: "M2" },
  { id: "S14", path: "/saude", title: "Saúde", purpose: "Treino e alimentação do dia.", milestone: "M4" },
  { id: "S15", path: "/saude/treino", title: "Treino", purpose: "Ficha, séries e cargas.", milestone: "M4" },
  { id: "S16", path: "/saude/dieta", title: "Dieta", purpose: "Plano alimentar e registro de refeições.", milestone: "M4" },
  { id: "S17", path: "/saude/progresso", title: "Progresso do corpo", purpose: "Peso e medidas ao longo do tempo.", milestone: "M4" },
  { id: "S18", path: "/dinheiro", title: "Dinheiro", purpose: "O mês num olhar: entrou, saiu, sobrou.", milestone: "M2" },
  { id: "S19", path: "/dinheiro/variaveis", title: "Gastos do dia a dia", purpose: "Gastos por dia e categoria, com o ritmo do mês.", milestone: "M3" },
  { id: "S20", path: "/dinheiro/fixos", title: "Fixos", purpose: "Assinaturas, contas fixas e entradas que se repetem.", milestone: "M3" },
  { id: "S21", path: "/dinheiro/parcelas", title: "Parcelas", purpose: "Compras parceladas e quando terminam.", milestone: "M3" },
  { id: "S22", path: "/dinheiro/contas", title: "Contas e cartões", purpose: "Saldos, limites e faturas.", milestone: "M3" },
  { id: "S23", path: "/dinheiro/analise", title: "Análise", purpose: "Padrões de vários meses.", milestone: "M3" },
  { id: "S24", path: "/dinheiro/extrato", title: "Extrato", purpose: "Todos os lançamentos, com busca.", milestone: "M1" },
  { id: "S25", path: "/metas", title: "Metas", purpose: "Objetivos com progresso e ritmo.", milestone: "M3" },
  { id: "S26", path: "/notas", title: "Notas", purpose: "Ideias, cadernos e diário.", milestone: "M3" },
  { id: "S27", path: "/automacoes", title: "Revisões agendadas", purpose: "Resumos que chegam no dia e hora que você escolhe.", milestone: "M3" },
  { id: "S28", path: "/avisos", title: "Avisos", purpose: "O que o assistente mandou para você.", milestone: "M3" },
  { id: "S29", path: "/ajustes", title: "Ajustes", purpose: "Conta, assinatura, canais e preferências.", milestone: "M2" },
  { id: "S30", path: "/ajustes/assistente", title: "Jeito do assistente", purpose: "Tom, voz, memória e aparência.", milestone: "M3" },
  { id: "S31", path: "/entrar", title: "Entrar", purpose: "Login, cadastro e recuperação de senha.", milestone: "M2" },
  { id: "S32", path: "/planos", title: "Planos", purpose: "Assinar o plano mensal ou anual.", milestone: "M2" },
];

export const screenById = (id: string) => screens.find((s) => s.id === id)!;
