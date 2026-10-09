import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, DEFAULT_WHATSAPP, limitReply, limitsFor, whatsappLimit } from "./limits";

describe("limites por plano", () => {
  it("usa os padrões e separa teste de plano pago", () => {
    expect(limitsFor("trial", {}).messagesPerDay).toBe(DEFAULT_LIMITS.trialMessages);
    expect(limitsFor("monthly", {}).messagesPerDay).toBe(DEFAULT_LIMITS.paidMessages);
    expect(limitsFor("yearly", {}).costUsdPerDay).toBe(DEFAULT_LIMITS.costUsd);
  });
  it("lê a configuração, aceita vírgula e ignora valor inválido", () => {
    const env = { LIMIT_DAILY_MESSAGES_TRIAL: "10", LIMIT_DAILY_MESSAGES_PAID: "abc", LIMIT_DAILY_COST_USD: "1,5" };
    expect(limitsFor("trial", env).messagesPerDay).toBe(10);
    expect(limitsFor("monthly", env).messagesPerDay).toBe(DEFAULT_LIMITS.paidMessages);
    expect(limitsFor("monthly", env).costUsdPerDay).toBe(1.5);
  });
  it("0 ou off desliga o teto de custo", () => {
    expect(limitsFor("monthly", { LIMIT_DAILY_COST_USD: "0" }).costUsdPerDay).toBeNull();
    expect(limitsFor("monthly", { LIMIT_DAILY_COST_USD: "off" }).costUsdPerDay).toBeNull();
  });
  it("manda a resposta certa para cada limite e deixa passar abaixo deles", () => {
    const l = limitsFor("monthly", { LIMIT_DAILY_MESSAGES_PAID: "5", LIMIT_DAILY_COST_USD: "1" });
    expect(limitReply("monthly", { lastMinute: 0, today: 4, costTodayUsd: 0.5 }, l)).toBeNull();
    expect(limitReply("monthly", { lastMinute: 12, today: 0, costTodayUsd: 0 }, l)).toMatch(/minutinho/);
    expect(limitReply("monthly", { lastMinute: 0, today: 5, costTodayUsd: 0 }, l)).toMatch(/limite de mensagens de hoje/);
    expect(limitReply("trial", { lastMinute: 0, today: 99, costTodayUsd: 0 }, limitsFor("trial", {}))).toMatch(/período de teste/);
    expect(limitReply("monthly", { lastMinute: 0, today: 1, costTodayUsd: 1 }, l)).toMatch(/espaço/);
  });
  it("números de WhatsApp por plano: padrão, configurado e com teto de segurança", () => {
    expect(whatsappLimit("trial", {})).toBe(DEFAULT_WHATSAPP.trial);
    expect(whatsappLimit("monthly", {})).toBe(DEFAULT_WHATSAPP.monthly);
    expect(whatsappLimit("yearly", { LIMIT_WHATSAPP_YEARLY: "5" })).toBe(5);
    expect(whatsappLimit("none", { LIMIT_WHATSAPP_TRIAL: "2" })).toBe(2);
    expect(whatsappLimit("monthly", { LIMIT_WHATSAPP_MONTHLY: "999" })).toBe(20);
  });
});
