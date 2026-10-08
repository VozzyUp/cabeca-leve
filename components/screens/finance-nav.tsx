import { SubNav } from "@/components/ui/subnav";

// Páginas da área de dinheiro
export function FinanceNav() {
  return (
    <SubNav label="Páginas de dinheiro" items={[
      { href: "/dinheiro", label: "Resumo" },
      { href: "/dinheiro/variaveis", label: "Dia a dia" },
      { href: "/dinheiro/fixos", label: "Fixos" },
      { href: "/dinheiro/parcelas", label: "Parcelas" },
      { href: "/dinheiro/contas", label: "Contas e cartões" },
      { href: "/dinheiro/analise", label: "Análise" },
      { href: "/dinheiro/extrato", label: "Extrato" },
      { href: "/dinheiro/categorias", label: "Categorias" },
    ]} />
  );
}
