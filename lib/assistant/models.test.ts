import { describe, expect, it } from "vitest";
import { DEFAULT_EFFORT, DEFAULT_MODEL, EFFORT_OPTIONS, MODEL_OPTIONS, resolveEffort, resolveModel, supportsFallback } from "./models";

describe("modelo e nível do assistente", () => {
  it("aceita só os modelos e níveis da lista; o resto cai no padrão", () => {
    for (const m of MODEL_OPTIONS) expect(resolveModel(m.id)).toBe(m.id);
    for (const e of EFFORT_OPTIONS) expect(resolveEffort(e.id)).toBe(e.id);
    expect(resolveModel(undefined)).toBe(DEFAULT_MODEL);
    expect(resolveModel("")).toBe(DEFAULT_MODEL);
    expect(resolveModel("claude-opus-5-5-20260401")).toBe(DEFAULT_MODEL);  // sem sufixo de data
    expect(resolveEffort("altíssimo")).toBe(DEFAULT_EFFORT);
    expect(resolveModel("  claude-haiku-5-5 ")).toBe("claude-haiku-5-5");
  });
  it("o padrão é o Sonnet 5.5 no nível médio, e só o Haiku fica sem reserva automática", () => {
    expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    expect(DEFAULT_EFFORT).toBe("medium");
    expect(MODEL_OPTIONS.map((m) => m.id)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
    expect(MODEL_OPTIONS.filter((m) => !supportsFallback(m.id)).map((m) => m.id)).toEqual(["claude-haiku-5-5"]);
  });
});
