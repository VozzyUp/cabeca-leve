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

describe("tarefas e hábitos", () => {
  it("tarefa com prazo em dia da semana (hoje é terça, 7/10)", () => {
    expect(parseMessage("cria uma tarefa de enviar o relatório até sexta", NOW, TZ)[0])
      .toEqual({ kind: "task", title: "Enviar o relatório", dueOn: "2026-10-09", priority: "medium" });
  });
  it("tarefa urgente para amanhã", () => {
    expect(parseMessage("adiciona tarefa pagar o boleto amanhã, é urgente", NOW, TZ)[0])
      .toEqual({ kind: "task", title: "Pagar o boleto", dueOn: "2026-10-08", priority: "high" });
  });
  it("tarefa sem prazo", () => {
    expect(parseMessage("anota a tarefa: organizar a garagem", NOW, TZ)[0]).toMatchObject({ title: "Organizar a garagem", dueOn: null });
  });
  it("hábito diário com horário", () => {
    expect(parseMessage("quero meditar 10 minutos todo dia às 7h", NOW, TZ)[0])
      .toEqual({ kind: "habit", name: "Meditar 10 minutos", weekdays: [0, 1, 2, 3, 4, 5, 6], time: "07:00" });
  });
  it("hábito em dias escolhidos", () => {
    expect(parseMessage("quero correr nas segundas, quartas e sextas às 6h30", NOW, TZ)[0])
      .toEqual({ kind: "habit", name: "Correr", weekdays: [1, 3, 5], time: "06:30" });
  });
  it("tarefa, hábito e gasto na mesma mensagem", () => {
    const r = parseMessage("gastei 20 no almoço, cria uma tarefa de ligar pro banco amanhã e quero ler todo dia às 21h", NOW, TZ);
    expect(r.map((x) => x.kind)).toEqual(["transaction", "task", "habit"]);
  });
});

describe("lembretes que se repetem", () => {
  const now = new Date("2026-10-08T13:00:00Z");  // quinta, 10:00 em São Paulo
  const one = (text: string) => parseMessage(text, now, "America/Sao_Paulo")[0] as Extract<ReturnType<typeof parseMessage>[number], { kind: "reminder" }>;
  it("todo dia às 8h começa amanhã, porque 8h de hoje já passou", () => {
    const r = one("me lembra de tomar o remédio todo dia às 8h");
    expect(r.title).toBe("Tomar o remédio");
    expect(r.recurrenceRule).toBe("FREQ=DAILY;INTERVAL=1");
    expect(r.at.toISOString()).toBe("2026-10-09T11:00:00.000Z");
  });
  it("toda segunda e quarta", () => {
    const r = one("me lembra de levar o lixo toda segunda e quarta às 20h");
    expect(r.recurrenceRule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE");
    expect(r.at.toISOString()).toBe("2026-10-12T23:00:00.000Z");
    expect(r.title).toBe("Levar o lixo");
  });
  it("todo dia 5 é mensal", () => {
    const r = one("me lembra de pagar o aluguel todo dia 5 às 9h");
    expect(r.recurrenceRule).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5");
    expect(r.at.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(r.title).toBe("Pagar o aluguel");
  });
  it("sem repetição continua igual", () => {
    expect(one("me lembra de ligar pro banco amanhã às 9h").recurrenceRule).toBeNull();
  });
});

describe("pedir uma pessoa", () => {
  it("reconhece os jeitos comuns de pedir um humano", async () => {
    const { wantsHuman } = await import("./rule-parser");
    for (const t of ["quero falar com uma pessoa", "me passa pro suporte", "atendimento humano por favor", "Quero falar com um atendente", "posso conversar com alguém do time?"]) {
      expect(wantsHuman(t), t).toBe(true);
    }
    for (const t of ["gastei 30 no almoço", "me lembra de ligar pra minha mãe", "falar com a pessoa do RH amanhã às 10h", "me lembra de falar com alguém sobre o carro"]) {
      expect(wantsHuman(t), t).toBe(false);
    }
  });
});

describe("teto de gastos", () => {
  it("entende definir e tirar o teto", async () => {
    const { parseBudget } = await import("./rule-parser");
    expect(parseBudget("teto de 500 em alimentação")).toEqual({ categoryName: "alimentação", amountCents: 50000 });
    expect(parseBudget("coloca um teto de R$ 1.200,50 por mês no transporte")).toEqual({ categoryName: "transporte", amountCents: 120050 });
    expect(parseBudget("tira o teto de lazer")).toEqual({ categoryName: "lazer", amountCents: null });
    expect(parseBudget("gastei 500 em alimentação")).toBeNull();
  });
});
