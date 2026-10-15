import { describe, expect, it } from "vitest";
import type { Doc, DocFolder } from "@/lib/data/types";
import {
  dueDateFor, deadlineOf, deadlineText, daysUntil, filterDocs, followsFolderDeadline, nextAlertStage, parseReais, reaisText, sortDocs, statusPatch, totalsByStatus,
} from "./documents";

const doc = (over: Partial<Doc> = {}): Doc => ({
  id: crypto.randomUUID(), folderId: null, title: "Consulta", issuer: null, beneficiary: null, category: null, docDate: "2026-10-01", amountCents: 10000,
  status: "pending", dueOn: null, submittedOn: null, reimbursedOn: null, alertStage: 0, notes: null, fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1000,
  source: "web", createdAt: "2026-10-02T10:00:00Z", ...over,
});

describe("prazo", () => {
  it("soma os dias da pasta à data do documento", () => {
    expect(dueDateFor("2026-10-01", 30)).toBe("2026-10-31");
    expect(dueDateFor("2026-12-20", 30)).toBe("2027-01-19");
    expect(dueDateFor(null, 30)).toBeNull();
    expect(dueDateFor("2026-10-01", null)).toBeNull();
  });
  it("conta os dias até o prazo", () => {
    expect(daysUntil("2026-10-20", "2026-10-15")).toBe(5);
    expect(daysUntil("2026-10-15", "2026-10-15")).toBe(0);
    expect(daysUntil("2026-10-14", "2026-10-15")).toBe(-1);
  });
  it("só o pendente com prazo tem prazo correndo", () => {
    expect(deadlineOf(doc({ status: "pending", dueOn: "2026-10-30" }), "2026-10-15")).toEqual({ state: "ok", days: 15 });
    expect(deadlineOf(doc({ status: "pending", dueOn: "2026-10-22" }), "2026-10-15")).toEqual({ state: "soon", days: 7 });
    expect(deadlineOf(doc({ status: "pending", dueOn: "2026-10-10" }), "2026-10-15")).toEqual({ state: "overdue", days: -5 });
    expect(deadlineOf(doc({ status: "submitted", dueOn: "2026-10-10" }), "2026-10-15")).toBeNull();
    expect(deadlineOf(doc({ status: null, dueOn: "2026-10-10" }), "2026-10-15")).toBeNull();
    expect(deadlineOf(doc({ status: "pending", dueOn: null }), "2026-10-15")).toBeNull();
  });
  it("escreve o prazo em português", () => {
    expect(deadlineText({ state: "ok", days: 12 })).toBe("vence em 12 dias");
    expect(deadlineText({ state: "soon", days: 1 })).toBe("vence amanhã");
    expect(deadlineText({ state: "soon", days: 0 })).toBe("vence hoje");
    expect(deadlineText({ state: "overdue", days: -1 })).toBe("venceu ontem");
    expect(deadlineText({ state: "overdue", days: -4 })).toBe("venceu há 4 dias");
  });
});

describe("aviso de prazo", () => {
  const today = "2026-10-15";
  it("avisa aos 7 dias, depois aos 2, e não repete", () => {
    expect(nextAlertStage(doc({ dueOn: "2026-10-22", alertStage: 0 }), today)).toBe(1);
    expect(nextAlertStage(doc({ dueOn: "2026-10-22", alertStage: 1 }), today)).toBeNull();
    expect(nextAlertStage(doc({ dueOn: "2026-10-17", alertStage: 1 }), today)).toBe(2);
    expect(nextAlertStage(doc({ dueOn: "2026-10-17", alertStage: 2 }), today)).toBeNull();
  });
  it("quem entra já em cima do prazo recebe só o aviso de 2 dias", () => {
    expect(nextAlertStage(doc({ dueOn: "2026-10-16", alertStage: 0 }), today)).toBe(2);
  });
  it("longe, vencido, enviado ou sem prazo: nada", () => {
    expect(nextAlertStage(doc({ dueOn: "2026-11-30" }), today)).toBeNull();
    expect(nextAlertStage(doc({ dueOn: "2026-10-14" }), today)).toBeNull();
    expect(nextAlertStage(doc({ dueOn: "2026-10-16", status: "submitted" }), today)).toBeNull();
    expect(nextAlertStage(doc({ dueOn: null }), today)).toBeNull();
  });
});

describe("filtros", () => {
  const roberta = doc({ id: "a", title: "Consulta", issuer: "Dra. Roberta Lima", beneficiary: "Ana", folderId: "f1", status: "pending" });
  const jantar = doc({ id: "b", title: "Jantar", issuer: "Restaurante Sol", folderId: "f2", status: "submitted", docDate: "2026-09-10" });
  const pedido = doc({ id: "c", title: "Pedido de ressonância", issuer: "Dr. João", status: null, docDate: null });
  const pago = doc({ id: "d", title: "Exame", issuer: "Lab Vida", folderId: "f1", status: "reimbursed" });
  const all = [roberta, jantar, pedido, pago];
  const ids = (r: Doc[]) => r.map((d) => d.id).sort();

  it("acha pelo nome do médico sem ligar para acento, caixa ou título", () => {
    expect(ids(filterDocs(all, { who: "roberta" }))).toEqual(["a"]);
    expect(ids(filterDocs(all, { who: "ROBERTA lima" }))).toEqual(["a"]);
    expect(ids(filterDocs(all, { who: "joao" }))).toEqual(["c"]);
    expect(ids(filterDocs(all, { who: "ana" }))).toEqual(["a"]);
  });
  it("busca livre no título e nas observações", () => {
    expect(ids(filterDocs(all, { query: "ressonancia" }))).toEqual(["c"]);
    expect(ids(filterDocs([doc({ id: "n", notes: "levar o laudo" })], { query: "LAUDO" }))).toEqual(["n"]);
  });
  it("status: cada um, 'open' (a receber) e 'stored' (só guardado)", () => {
    expect(ids(filterDocs(all, { status: "pending" }))).toEqual(["a"]);
    expect(ids(filterDocs(all, { status: "open" }))).toEqual(["a", "b"]);
    expect(ids(filterDocs(all, { status: "stored" }))).toEqual(["c"]);
    expect(ids(filterDocs(all, { status: "reimbursed" }))).toEqual(["d"]);
  });
  it("pendentes de todas as pastas ao mesmo tempo", () => {
    const more = [...all, doc({ id: "e", folderId: "f2", status: "pending" })];
    expect(ids(filterDocs(more, { status: "pending" }))).toEqual(["a", "e"]);
  });
  it("pasta, sem pasta e período", () => {
    expect(ids(filterDocs(all, { folderId: "f1" }))).toEqual(["a", "d"]);
    expect(ids(filterDocs(all, { folderId: "none" }))).toEqual(["c"]);
    expect(ids(filterDocs(all, { from: "2026-10-01" }))).toEqual(["a", "d"]);
    expect(ids(filterDocs(all, { to: "2026-09-30" }))).toEqual(["b"]);
  });
  it("combina os filtros", () => {
    expect(ids(filterDocs(all, { folderId: "f1", status: "pending", who: "roberta" }))).toEqual(["a"]);
    expect(filterDocs(all, { folderId: "f2", who: "roberta" })).toEqual([]);
  });
});

describe("totais", () => {
  it("soma por status e ignora o que é só guardado", () => {
    const t = totalsByStatus([
      doc({ status: "pending", amountCents: 10000 }), doc({ status: "pending", amountCents: 2550 }), doc({ status: "submitted", amountCents: 5000 }),
      doc({ status: "reimbursed", amountCents: null }), doc({ status: null, amountCents: 99999 }),
    ]);
    expect(t.pending).toEqual({ count: 2, cents: 12550 });
    expect(t.submitted).toEqual({ count: 1, cents: 5000 });
    expect(t.reimbursed).toEqual({ count: 1, cents: 0 });
  });
});

describe("ordem", () => {
  it("prazo mais perto primeiro; sem prazo depois, o mais recente antes", () => {
    const a = doc({ id: "a", dueOn: "2026-10-30" }), b = doc({ id: "b", dueOn: "2026-10-20" });
    const c = doc({ id: "c", dueOn: null, docDate: "2026-10-10" }), d = doc({ id: "d", dueOn: null, docDate: "2026-10-12" });
    expect(sortDocs([a, c, b, d]).map((x) => x.id)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("troca de status", () => {
  it("enviado marca a data; reembolsado mantém a do envio; pendente limpa as duas", () => {
    expect(statusPatch("submitted", { submittedOn: null, reimbursedOn: null }, "2026-10-15")).toEqual({ status: "submitted", submittedOn: "2026-10-15", reimbursedOn: null, alertStage: 0 });
    expect(statusPatch("reimbursed", { submittedOn: "2026-10-10", reimbursedOn: null }, "2026-10-15")).toEqual({ status: "reimbursed", submittedOn: "2026-10-10", reimbursedOn: "2026-10-15", alertStage: 0 });
    expect(statusPatch("reimbursed", { submittedOn: null, reimbursedOn: null }, "2026-10-15").submittedOn).toBe("2026-10-15");
    expect(statusPatch("pending", { submittedOn: "2026-10-10", reimbursedOn: "2026-10-12" }, "2026-10-15")).toEqual({ status: "pending", submittedOn: null, reimbursedOn: null, alertStage: 0 });
  });
});

describe("prazo que segue a pasta", () => {
  const folders: DocFolder[] = [{ id: "f1", name: "Convênio", deadlineDays: 30, createdAt: "" }];
  it("segue enquanto for o que a pasta sugeriria", () => {
    expect(followsFolderDeadline({ dueOn: "2026-10-31", docDate: "2026-10-01", folderId: "f1" }, folders)).toBe(true);
    expect(followsFolderDeadline({ dueOn: null, docDate: "2026-10-01", folderId: "f1" }, folders)).toBe(true);
  });
  it("ajuste à mão não é sobrescrito", () => {
    expect(followsFolderDeadline({ dueOn: "2026-11-15", docDate: "2026-10-01", folderId: "f1" }, folders)).toBe(false);
  });
});

describe("valor em reais", () => {
  it.each([
    ["187,50", 18750], ["187.50", 18750], ["187,5", 18750], ["R$ 50", 5000], ["1.234,56", 123456], ["1,234.56", 123456],
    ["1.234", 123400], ["12", 1200], ["0,99", 99], [" R$ 1.000,00 ", 100000],
  ])("%s -> %i centavos", (text, cents) => expect(parseReais(text)).toBe(cents));
  it.each(["", "abc", "-5", "12,3,4x", "R$"])("recusa %j", (text) => expect(parseReais(text)).toBeNull());
  it("volta para o campo", () => { expect(reaisText(18750)).toBe("187,50"); expect(reaisText(null)).toBe(""); });
});
