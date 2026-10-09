import { describe, expect, it } from "vitest";
import { parentOf, showBackOnDesktop, showBackOnMobile } from "./navigation";

describe("navegação", () => {
  it("voltar sobe um nível, e as seções soltas voltam para Tudo", () => {
    expect(parentOf("/ajustes/assistente")).toBe("/ajustes");
    expect(parentOf("/habitos/abc")).toBe("/habitos");
    expect(parentOf("/dinheiro/extrato")).toBe("/dinheiro");
    expect(parentOf("/notas")).toBe("/mais");
    expect(parentOf("/admin/custos")).toBe("/ajustes");
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
