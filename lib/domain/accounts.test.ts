import { describe, expect, it } from "vitest";
import { accountState, filterAccounts, isValidPlanEnd, needsAttention, renewFrom, summarizeAccounts, type AccountRow } from "./accounts";

const TODAY = "2026-10-15";
const row = (over: Partial<AccountRow> = {}): AccountRow => ({
  userId: crypto.randomUUID(), email: "ana@exemplo.com", name: "Ana", createdAt: "2026-10-01T10:00:00Z", lastSignInAt: null, trialEndsOn: "2026-10-20",
  subPlan: null, subStatus: null, subEnd: null, subRef: null, subCancels: null, whatsapps: 1, documents: 0, storageBytes: 0, messages30d: 5, lastMessageAt: null, ...over,
});
const paid = (over: Partial<AccountRow> = {}) => row({ subPlan: "monthly", subStatus: "active", subEnd: "2026-11-15T23:59:59Z", subRef: "sub_123", subCancels: false, ...over });

describe("situação da conta", () => {
  it("teste valendo, com os dias que faltam", () => {
    expect(accountState(row(), TODAY)).toMatchObject({ kind: "trial", label: "Teste", until: "2026-10-20", daysLeft: 5, manual: false });
    expect(accountState(row({ trialEndsOn: TODAY }), TODAY)).toMatchObject({ kind: "trial", daysLeft: 0 });
  });
  it("teste vencido sem plano", () => {
    expect(accountState(row({ trialEndsOn: "2026-10-10" }), TODAY)).toMatchObject({ kind: "expired", label: "Sem plano", daysLeft: -5 });
  });
  it("plano pago: mensal, anual, atrasado e cancelado que ainda vale", () => {
    expect(accountState(paid(), TODAY)).toMatchObject({ kind: "paid", label: "Mensal", plan: "monthly", until: "2026-11-15", daysLeft: 31 });
    expect(accountState(paid({ subPlan: "yearly" }), TODAY)).toMatchObject({ label: "Anual", plan: "yearly" });
    expect(accountState(paid({ subStatus: "past_due" }), TODAY).kind).toBe("past_due");
    expect(accountState(paid({ subCancels: true }), TODAY).kind).toBe("canceling");
    expect(accountState(paid({ subStatus: "canceled" }), TODAY).kind).toBe("canceling");
  });
  it("plano manual é reconhecido pelo prefixo; o teste não importa quando há plano", () => {
    expect(accountState(paid({ subRef: "manual-dono-2099", subEnd: "2099-12-31T23:59:59Z" }), TODAY)).toMatchObject({ manual: true, until: "2099-12-31" });
    expect(accountState(paid({ trialEndsOn: "2020-01-01" }), TODAY).kind).toBe("paid");
  });
});

describe("atenção", () => {
  it("quem precisa de olhar", () => {
    expect(needsAttention(row({ trialEndsOn: "2026-10-16" }), TODAY)).toBe(true);     // teste acaba em 1 dia
    expect(needsAttention(row({ trialEndsOn: "2026-10-25" }), TODAY)).toBe(false);
    expect(needsAttention(row({ trialEndsOn: "2026-10-12" }), TODAY)).toBe(true);     // acabou há 3 dias: dá para recuperar
    expect(needsAttention(row({ trialEndsOn: "2026-08-01" }), TODAY)).toBe(false);    // acabou faz tempo
    expect(needsAttention(paid({ subStatus: "past_due" }), TODAY)).toBe(true);
    expect(needsAttention(paid({ subCancels: true }), TODAY)).toBe(true);
    expect(needsAttention(paid({ subEnd: "2026-10-20T00:00:00Z" }), TODAY)).toBe(true); // renova em 5 dias
    expect(needsAttention(paid(), TODAY)).toBe(false);
    expect(needsAttention(paid({ subRef: "manual-x", subEnd: "2026-10-18T00:00:00Z" }), TODAY)).toBe(false); // manual não renova sozinho: o time sabe
  });
});

describe("filtros e busca", () => {
  const rows = [
    row({ email: "ana@exemplo.com", name: "Ana Lúcia" }),
    row({ email: "bia@exemplo.com", name: "Bia", trialEndsOn: "2026-09-01" }),
    paid({ email: "carlos@exemplo.com", name: "Carlos" }),
    paid({ email: "dono@exemplo.com", name: "Dono", subRef: "manual-dono", subEnd: "2099-12-31T23:59:59Z" }),
  ];
  const emails = (r: AccountRow[]) => r.map((x) => x.email!.split("@")[0]);
  it("por situação", () => {
    expect(emails(filterAccounts(rows, "trial", "", TODAY))).toEqual(["ana"]);
    expect(emails(filterAccounts(rows, "expired", "", TODAY))).toEqual(["bia"]);
    expect(emails(filterAccounts(rows, "paid", "", TODAY))).toEqual(["carlos", "dono"]);
    expect(emails(filterAccounts(rows, "manual", "", TODAY))).toEqual(["dono"]);
    expect(emails(filterAccounts(rows, "all", "", TODAY))).toHaveLength(4);
  });
  it("busca no e-mail e no nome, sem ligar para acento e caixa", () => {
    expect(emails(filterAccounts(rows, "all", "LUCIA", TODAY))).toEqual(["ana"]);
    expect(emails(filterAccounts(rows, "all", "carlos@", TODAY))).toEqual(["carlos"]);
    expect(filterAccounts(rows, "paid", "ana", TODAY)).toEqual([]);
  });
});

describe("resumo", () => {
  it("conta cada situação, manuais, novas da semana e quem usou nos últimos 30 dias", () => {
    const s = summarizeAccounts([
      row({ createdAt: "2026-10-14T00:00:00Z" }), row({ trialEndsOn: "2026-09-01", messages30d: 0 }), paid(), paid({ subRef: "manual-x", subEnd: "2099-12-31T00:00:00Z" }),
    ], TODAY);
    expect(s).toMatchObject({ total: 4, trial: 1, expired: 1, paid: 2, manual: 1, newThisWeek: 1, active30d: 3 });
  });
});

describe("renovar e validar", () => {
  it("soma a partir do fim se ainda vale, ou de hoje se já acabou", () => {
    expect(renewFrom("2026-11-01", TODAY, 30)).toBe("2026-12-01");
    expect(renewFrom("2026-10-01", TODAY, 30)).toBe("2026-11-14");
    expect(renewFrom(null, TODAY, 365)).toBe("2027-10-15");
    expect(renewFrom("2099-12-31", TODAY, 365)).toBe("2100-01-01");  // teto
  });
  it("data do plano: hoje em diante e até 2100", () => {
    expect(isValidPlanEnd("2099-12-31", TODAY)).toBe(true);
    expect(isValidPlanEnd(TODAY, TODAY)).toBe(true);
    expect(isValidPlanEnd("2026-10-14", TODAY)).toBe(false);
    expect(isValidPlanEnd("2100-01-02", TODAY)).toBe(false);
    expect(isValidPlanEnd("2026-13-40", TODAY)).toBe(false);
    expect(isValidPlanEnd("amanhã", TODAY)).toBe(false);
  });
});
