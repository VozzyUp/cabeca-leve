import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, limitReply, limitsFor, storageLimitBytes, whatsappLimit } from "./limits";
import { DEFAULT_PLANS } from "./plans";

const monthly = DEFAULT_PLANS[1];
const trial = DEFAULT_PLANS[0];

describe("limites por plano", () => {
  it("as mensagens por dia vêm do plano e o teto de custo é um só", () => {
    expect(limitsFor(trial, {}).messagesPerDay).toBe(40);
    expect(limitsFor(monthly, {}).messagesPerDay).toBe(200);
    expect(limitsFor({ ...monthly, messagesPerDay: 1500 }, {}).messagesPerDay).toBe(1500);
    expect(limitsFor(monthly, {}).costUsdPerDay).toBe(DEFAULT_LIMITS.costUsd);
  });
  it("lê o teto de custo, aceita vírgula e ignora valor inválido", () => {
    expect(limitsFor(monthly, { LIMIT_DAILY_COST_USD: "1,5" }).costUsdPerDay).toBe(1.5);
    expect(limitsFor(monthly, { LIMIT_DAILY_COST_USD: "abc" }).costUsdPerDay).toBe(DEFAULT_LIMITS.costUsd);
  });
  it("0 ou off desliga o teto de custo", () => {
    expect(limitsFor(monthly, { LIMIT_DAILY_COST_USD: "0" }).costUsdPerDay).toBeNull();
    expect(limitsFor(monthly, { LIMIT_DAILY_COST_USD: "off" }).costUsdPerDay).toBeNull();
  });
  it("manda a resposta certa para cada limite e deixa passar abaixo deles", () => {
    const l = limitsFor({ ...monthly, messagesPerDay: 5 }, { LIMIT_DAILY_COST_USD: "1" });
    expect(limitReply("monthly", { lastMinute: 0, today: 4, costTodayUsd: 0.5 }, l)).toBeNull();
    expect(limitReply("monthly", { lastMinute: 12, today: 0, costTodayUsd: 0 }, l)).toMatch(/minutinho/);
    expect(limitReply("monthly", { lastMinute: 0, today: 5, costTodayUsd: 0 }, l)).toMatch(/limite de mensagens de hoje/);
    expect(limitReply("trial", { lastMinute: 0, today: 99, costTodayUsd: 0 }, limitsFor(trial, {}))).toMatch(/período de teste/);
    expect(limitReply("monthly", { lastMinute: 0, today: 1, costTodayUsd: 1 }, l)).toMatch(/espaço/);
  });
  it("WhatsApps e espaço vêm do plano", () => {
    expect(whatsappLimit(trial)).toBe(1);
    expect(whatsappLimit({ ...monthly, whatsappLimit: 5 })).toBe(5);
    expect(storageLimitBytes(trial)).toBe(100 * 1024 * 1024);
    expect(storageLimitBytes({ ...monthly, storageMb: 5000 })).toBe(5000 * 1024 * 1024);
  });
});
