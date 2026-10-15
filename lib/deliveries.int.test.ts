import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { zonedParts } from "@/lib/time";

// Entregas no horário contra o Supabase local e uma UAZAPI falsa.
// SUPABASE_TEST=1 npx vitest run lib/deliveries.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("entregas", () => {
  const sent: Array<{ number: string; text: string; choices?: string[] }> = [];
  let server: http.Server;
  let userId = "";
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => { if (req.url === "/send/text" || req.url === "/send/menu") sent.push(JSON.parse(data)); res.end("{}"); });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), WHATSAPP_PROVIDER: "uazapi",
      UAZAPI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, UAZAPI_INSTANCE_TOKEN: "tok", UAZAPI_WEBHOOK_SECRET: "s",
    });
    const { data } = await admin.auth.admin.createUser({ email: `entrega-${Date.now()}@teste.local`, password: "x".repeat(12), email_confirm: true, user_metadata: { name: "Bia" } });
    userId = data.user!.id;
    await admin.from("channel_links").insert({ user_id: userId, channel: "whatsapp", external_id: `+55119${String(Date.now()).slice(-8)}`, verified_at: new Date().toISOString() });
  });
  afterAll(async () => {
    server.close();
    await admin.auth.admin.deleteUser(userId);
  });

  it("lembrete vencido sai uma vez só, mesmo com duas varreduras juntas", async () => {
    const { deliverDueReminders } = await import("./deliveries");
    const { data: r } = await admin.from("reminders").insert({ user_id: userId, title: "Tomar o remédio", next_fire_at: new Date(Date.now() - 30_000).toISOString(),
      timezone: "America/Sao_Paulo" }).select("id").single();
    await Promise.all([deliverDueReminders(), deliverDueReminders()]);
    const mine = sent.filter((s) => s.text.includes("Tomar o remédio"));
    expect(mine).toHaveLength(1);
    expect(mine[0].text).toMatch(/^⏰ Lembrete: Tomar o remédio \(\d{2}:\d{2}\)$/);
    // o lembrete leva Feito e Adiar
    expect(mine[0].choices).toEqual([`✅ Feito|r:d:${r!.id}`, `⏰ Adiar|r:s:${r!.id}`]);
    await deliverDueReminders();
    expect(sent.filter((s) => s.text.includes("Tomar o remédio"))).toHaveLength(1);
    const { data: after } = await admin.from("reminders").select("last_fired_at").eq("id", r!.id).single();
    expect(after!.last_fired_at).toBeTruthy();
    const { data: notices } = await admin.from("notices").select("title").eq("user_id", userId).eq("kind", "reminder");
    expect(notices!.length).toBeGreaterThanOrEqual(1);
  });

  it("lembrete que se repete é reagendado para a próxima ocorrência", async () => {
    const { deliverDueReminders } = await import("./deliveries");
    const due = new Date(Date.now() - 60_000);
    const { data: r } = await admin.from("reminders").insert({ user_id: userId, title: "Beber água", next_fire_at: due.toISOString(),
      timezone: "America/Sao_Paulo", recurrence_rule: "FREQ=DAILY;INTERVAL=1" }).select("id").single();
    await deliverDueReminders();
    expect(sent.filter((s) => s.text.includes("Beber água"))).toHaveLength(1);
    const { data } = await admin.from("reminders").select("next_fire_at, status").eq("id", r!.id).single();
    expect(data!.status).toBe("active");
    // amanhã, mesma hora e minuto (os segundos não contam)
    const sameMinute = Math.floor(due.getTime() / 60_000) * 60_000;
    expect(new Date(data!.next_fire_at!).getTime()).toBe(sameMinute + 86_400_000);
    await deliverDueReminders();
    expect(sent.filter((s) => s.text.includes("Beber água"))).toHaveLength(1);
  });

  it("resumo da manhã sai no horário escolhido e uma vez por dia", async () => {
    const { deliverBriefings } = await import("./deliveries");
    const p = zonedParts(new Date(), "America/Sao_Paulo");
    const hhmm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
    await admin.from("profiles").update({ briefing_enabled: true, briefing_time: hhmm }).eq("user_id", userId);
    await admin.from("tasks").insert({ user_id: userId, title: "Enviar a proposta", due_on: new Date().toISOString().slice(0, 10) });
    await deliverBriefings();
    const brief = sent.filter((s) => s.text.includes("Bia."));
    expect(brief).toHaveLength(1);
    expect(brief[0].text).toMatch(/(Bom dia|Boa tarde|Boa noite), Bia\./);
    await deliverBriefings();
    expect(sent.filter((s) => s.text.includes("Bia."))).toHaveLength(1);
  });

  it("prazo do reembolso: avisa 7 e 2 dias antes, só depois das 9h, uma vez por prazo e só do que está pendente", async () => {
    const { deliverDocumentAlerts } = await import("./deliveries");
    const row = (title: string, due: string | null, status: string | null, cents: number | null) => ({
      user_id: userId, title, due_on: due, status, amount_cents: cents, file_path: `${userId}/${title}.pdf`, file_name: `${title}.pdf`, mime_type: "application/pdf", size_bytes: 1000,
    });
    await admin.from("documents").insert([
      row("Sete dias", "2026-10-27", "pending", 35000),       // 7 dias depois de 20/10
      row("Dois dias", "2026-10-22", "pending", 18750),
      row("Longe", "2026-11-30", "pending", 100),
      row("Enviada", "2026-10-22", "submitted", 100),         // já pedida: não avisa
      row("Vencida", "2026-10-18", "pending", 100),           // passou: o app mostra em vermelho, não avisa
      row("Pedido", null, null, null),                        // só guardado
    ]);
    const mine = () => sent.filter((s) => s.text.includes("prazo do reembolso"));
    const stages = async () => Object.fromEntries(((await admin.from("documents").select("title, alert_stage").eq("user_id", userId)).data ?? []).map((d) => [d.title, d.alert_stage]));

    // 07h em São Paulo: cedo demais
    expect(await deliverDocumentAlerts(new Date("2026-10-20T10:00:00Z"))).toBe(0);
    expect(mine()).toHaveLength(0);

    // 10h: uma mensagem só, com as duas notas que entraram na janela
    expect(await deliverDocumentAlerts(new Date("2026-10-20T13:00:00Z"))).toBe(1);
    expect(mine()).toHaveLength(1);
    expect(mine()[0].text).toMatch(/2 notas estão perto do prazo do reembolso/);
    expect(mine()[0].text).toMatch(/R\$\s537,50/);  // 350 + 187,50
    expect(mine()[0].text).toContain("Sete dias");
    expect(mine()[0].text).toContain("vence em 7 dias");
    expect(mine()[0].text).toContain("Dois dias");
    for (const out of ["Longe", "Enviada", "Vencida", "Pedido"]) expect(mine()[0].text).not.toContain(out);
    expect(await stages()).toMatchObject({ "Sete dias": 1, "Dois dias": 2, Longe: 0, Enviada: 0, Vencida: 0 });
    expect((await admin.from("notices").select("title").eq("user_id", userId).eq("title", "Prazo do reembolso")).data).toHaveLength(1);

    // varredura repetida (e duas ao mesmo tempo): nada novo
    await Promise.all([deliverDocumentAlerts(new Date("2026-10-20T13:01:00Z")), deliverDocumentAlerts(new Date("2026-10-20T13:01:00Z"))]);
    expect(mine()).toHaveLength(1);
    // no dia seguinte, os dois já foram avisados naquele prazo
    expect(await deliverDocumentAlerts(new Date("2026-10-21T13:00:00Z"))).toBe(0);

    // 25/10: a "Sete dias" entra na janela de 2 dias e avisa de novo, só ela (a outra já venceu)
    expect(await deliverDocumentAlerts(new Date("2026-10-25T13:00:00Z"))).toBe(1);
    expect(mine()).toHaveLength(2);
    expect(mine()[1].text).toMatch(/1 nota está perto do prazo/);
    expect(mine()[1].text).toContain("vence em 2 dias");
    expect(mine()[1].text).not.toContain("Dois dias");
    expect(await stages()).toMatchObject({ "Sete dias": 2 });
  });
});
