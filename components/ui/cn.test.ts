import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("mantém os tipos próprios junto de uma cor", () => {
    expect(cn("text-label", "text-muted")).toBe("text-label text-muted");
    expect(cn("text-metric", "text-income")).toBe("text-metric text-income");
  });
  it("resolve conflito de espaçamento", () => {
    expect(cn("p-4", "p-0")).toBe("p-0");
  });
});
