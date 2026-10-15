import { describe, expect, it } from "vitest";
import { parentOf, showBackOnDesktop, showBackOnMobile } from "./navigation";

describe("navegação", () => {
  it("voltar sobe um nível, e as seções soltas voltam para Tudo", () => {
    expect(parentOf("/ajustes/assistente")).toBe("/ajustes");
    expect(parentOf("/habitos/abc")).toBe("/habitos");
    expect(parentOf("/dinheiro/extrato")).toBe("/dinheiro");
    expect(parentOf("/notas")).toBe("/mais");
    // o time tem a própria área: as telas dele sobem para Administração, que sobe para a conversa
    for (const path of ["/admin/custos", "/admin/contas", "/admin/configuracoes", "/suporte/painel"]) expect(parentOf(path)).toBe("/admin");
    expect(parentOf("/admin/contas/6fe3669b-559b-4f42-8aea-33e34357042d")).toBe("/admin/contas");
    expect(parentOf("/admin")).toBe("/conversa");
  });
  it("celular: sem voltar nas abas da barra inferior", () => {
    expect(showBackOnMobile("/conversa")).toBe(false);
    expect(showBackOnMobile("/dinheiro")).toBe(false);
    expect(showBackOnMobile("/notas")).toBe(true);
    expect(showBackOnMobile("/dinheiro/extrato")).toBe(true);
  });
  it("computador: só em página de detalhe fora das áreas com abas", () => {
    expect(showBackOnDesktop("/notas")).toBe(false);
    expect(showBackOnDesktop("/dinheiro/extrato")).toBe(false);
    expect(showBackOnDesktop("/ajustes/assistente")).toBe(true);
    expect(showBackOnDesktop("/habitos/abc")).toBe(true);
  });
});
