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
});
