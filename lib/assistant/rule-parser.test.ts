import { describe, expect, it } from "vitest";
import { localDate, zonedParts } from "@/lib/time";
import { parseMessage, splitClauses } from "./rule-parser";

const TZ = "America/Sao_Paulo";
// terça, 7 de outubro de 2026, 14:00 em Brasília (17:00 UTC)
const NOW = new Date("2026-10-07T17:00:00Z");
const local = (d: Date) => { const p = zonedParts(d, TZ); return `${localDate(d, TZ)} ${p.hour}:${String(p.minute).padStart(2, "0")}`; };

describe("splitClauses", () => {
  it("separa gasto e lembrete numa frase só", () => {
    expect(splitClauses("gastei 35 na padaria e me lembra do mercado às 18h"))
      .toEqual(["gastei 35 na padaria", "me lembra do mercado às 18h"]);
  });
  it("não corta um título que tem 'e' no meio", () => {
    expect(splitClauses("me lembra de comprar pão e leite às 19h")).toHaveLength(1);
  });
});

describe("parseMessage", () => {
  it("gasto com valor inteiro, categoria e Pix", () => {
    const [i] = parseMessage("gastei 35 na padaria no pix", NOW, TZ);
    expect(i).toMatchObject({ kind: "transaction", type: "expense", amountCents: 3500,
      description: "Padaria", categoryName: "Alimentação", paymentMethod: "pix" });
  });
  it("valor com centavos e milhar no formato brasileiro", () => {
    expect(parseMessage("paguei R$ 1.250,90 de aluguel", NOW, TZ)[0]).toMatchObject({ amountCents: 125090, categoryName: "Moradia" });
    expect(parseMessage("gastei 12,5 com uber", NOW, TZ)[0]).toMatchObject({ amountCents: 1250, categoryName: "Transporte" });
  });
  it("entrada de salário", () => {
    expect(parseMessage("recebi 4500 do salário", NOW, TZ)[0]).toMatchObject({ type: "income", amountCents: 450000, categoryName: "Salário" });
  });
  it("lembrete hoje à tarde, no fuso de Brasília", () => {
    const [i] = parseMessage("me lembra do mercado às 18h", NOW, TZ);
    expect(i.kind).toBe("reminder");
    if (i.kind !== "reminder") return;
    expect(i.title).toBe("Mercado");
    expect(local(i.at)).toBe("2026-10-07 18:00");
  });
  it("horário que já passou vai para amanhã", () => {
    const [i] = parseMessage("me lembra de tomar o remédio às 8h", NOW, TZ);
    if (i.kind !== "reminder") throw new Error("esperava lembrete");
    expect(local(i.at)).toBe("2026-10-08 8:00");
    expect(i.title).toBe("Tomar o remédio");
  });
  it("amanhã com minutos", () => {
    const [i] = parseMessage("amanhã às 9:30 me lembra de ligar para o dentista", NOW, TZ);
    if (i.kind !== "reminder") throw new Error("esperava lembrete");
    expect(local(i.at)).toBe("2026-10-08 9:30");
    expect(i.title).toBe("Ligar para o dentista");
  });
  it("a frase completa da fatia vertical", () => {
    const r = parseMessage("gastei 35 na padaria e me lembra do mercado às 18h", NOW, TZ);
    expect(r.map((x) => x.kind)).toEqual(["transaction", "reminder"]);
  });
  it("frase sem pedido reconhecível", () => {
    expect(parseMessage("como você está?", NOW, TZ)).toEqual([]);
  });
});
