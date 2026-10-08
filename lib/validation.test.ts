import { describe, expect, it } from "vitest";
import { safeAppPath } from "./validation";

describe("safeAppPath", () => {
  it("aceita caminhos do app com busca", () => {
    expect(safeAppPath("/tarefas")).toBe("/tarefas");
    expect(safeAppPath("/dinheiro/extrato?mes=2026-10")).toBe("/dinheiro/extrato?mes=2026-10");
  });
  it("recusa tudo que sai do app", () => {
    for (const evil of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "", null, ["/x"]]) {
      expect(safeAppPath(evil)).toBe("/conversa");
    }
  });
});
