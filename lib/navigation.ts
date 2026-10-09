// Mapa da navegação: seções do menu lateral (computador), grupos da tela "Tudo" (celular)
// e para onde o botão de voltar leva quando não há página anterior.

export type NavLink = { href: string; label: string; hint?: string };
export type NavGroup = { title: string; items: NavLink[] };

// Barra inferior do celular: estas não têm botão de voltar
export const MOBILE_TABS = ["/conversa", "/dia", "/tarefas", "/dinheiro", "/mais"] as const;

// Áreas com abas próprias (SubNav): no computador, trocar de aba não pede "voltar"
const TABBED_AREAS = ["dia", "dinheiro", "saude"];

// Para onde sobe cada página quando não há histórico (entrou direto pelo link, por exemplo)
const PARENTS: Record<string, string> = {
  "/admin/configuracoes": "/ajustes",
  "/admin/custos": "/ajustes",
  "/suporte/painel": "/ajustes",
};

export function parentOf(path: string): string {
  const clean = path.replace(/\/+$/, "") || "/";
  if (PARENTS[clean]) return PARENTS[clean];
  const parts = clean.split("/").filter(Boolean);
  if (parts.length >= 2) return `/${parts.slice(0, -1).join("/")}`;
  return "/mais";
}

// Celular: voltar em tudo que não é aba da barra inferior
export function showBackOnMobile(path: string) {
  return !(MOBILE_TABS as readonly string[]).includes(path.replace(/\/+$/, "") || "/");
}

// Computador: o menu lateral leva a todas as seções; voltar só em página de detalhe
export function showBackOnDesktop(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.length >= 2 && !TABBED_AREAS.includes(parts[0]);
}

export const MORE_GROUPS: NavGroup[] = [
  { title: "Organização", items: [
    { href: "/briefing", label: "Resumo do dia", hint: "agenda, tarefas, hábitos e contas de hoje" },
    { href: "/dia/calendario", label: "Calendário", hint: "o mês ou a semana" },
    { href: "/lembretes", label: "Lembretes", hint: "avisos com dia e hora" },
    { href: "/projetos", label: "Projetos", hint: "entregas maiores, com etapas" },
    { href: "/notas", label: "Notas", hint: "ideias, cadernos e diário" },
    { href: "/agenda", label: "Agenda", hint: "Google Agenda e Outlook" },
    { href: "/foco", label: "Modo foco", hint: "trabalhar com tempo marcado" },
    { href: "/automacoes", label: "Revisões agendadas", hint: "resumos no dia e hora que você escolhe" },
  ] },
  { title: "Dinheiro", items: [
    { href: "/dinheiro/extrato", label: "Extrato", hint: "todos os lançamentos, com busca" },
    { href: "/dinheiro/variaveis", label: "Gastos do dia a dia" },
    { href: "/dinheiro/fixos", label: "Fixos", hint: "contas e entradas que se repetem" },
    { href: "/dinheiro/parcelas", label: "Parcelas" },
    { href: "/dinheiro/contas", label: "Contas e cartões" },
    { href: "/dinheiro/analise", label: "Análise", hint: "padrões de vários meses" },
    { href: "/dinheiro/categorias", label: "Categorias" },
  ] },
  { title: "Saúde e rotina", items: [
    { href: "/habitos", label: "Hábitos", hint: "rotina, constância e sequências" },
    { href: "/metas", label: "Metas", hint: "objetivos com progresso" },
    { href: "/saude", label: "Saúde", hint: "treino e alimentação de hoje" },
    { href: "/saude/treino", label: "Treino" },
    { href: "/saude/dieta", label: "Alimentação" },
    { href: "/saude/progresso", label: "Peso e medidas" },
  ] },
  { title: "Conta", items: [
    { href: "/avisos", label: "Avisos", hint: "o que o assistente mandou para você" },
    { href: "/ajustes", label: "Ajustes", hint: "conta, WhatsApp, notificações e dados" },
    { href: "/ajustes/assistente", label: "Jeito do assistente", hint: "tom, voz, memória e tema" },
    { href: "/ajustes/suporte", label: "Falar com uma pessoa" },
  ] },
];
