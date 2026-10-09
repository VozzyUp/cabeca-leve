import { storeForUser } from "@/lib/data";
import { buildBriefing } from "@/lib/domain/briefing";
import { dayItems } from "@/lib/domain/day";
import { nextFireAt } from "@/lib/domain/recurrence";
import { variableSpending } from "@/lib/domain/money";
import { emailEnabled, sendEmail } from "@/lib/email";
import { pushEnabled, sendPush } from "@/lib/push";
import { getAdmin } from "@/lib/supabase/server";
import { formatTime, localDate, zonedParts } from "@/lib/time";
import { whatsapp, type Proactive } from "@/lib/whatsapp/provider";

// Entregas no horário (lembretes e resumo da manhã), chamadas pela varredura de cada minuto.
// Cada envio reserva antes uma linha em scheduled_deliveries com chave única: se a varredura
// rodar duas vezes ao mesmo tempo, só uma manda.

type Channel = "push" | "whatsapp" | "email";

async function claim(userId: string, source: "reminder" | "briefing" | "automation", sourceId: string | null, channel: Channel, key: string, payload: Record<string, string>) {
  const { error } = await getAdmin().from("scheduled_deliveries").insert({
    user_id: userId, source_type: source, source_id: sourceId, channel, send_at: new Date().toISOString(), payload, dedupe_key: key, status: "scheduled",
  });
  return !error;  // conflito na chave = outra varredura já pegou
}

async function finish(key: string, error: string | null) {
  await getAdmin().from("scheduled_deliveries").update({ status: error ? "failed" : "sent", sent_at: error ? null : new Date().toISOString(), error, attempts: 1 })
    .eq("dedupe_key", key);
}

async function channelsFor(userId: string) {
  const db = getAdmin();
  const [{ data: profile }, { data: link }] = await Promise.all([
    db.from("profiles").select("notify_push").eq("user_id", userId).single(),
    db.from("channel_links").select("external_id, last_inbound_at").eq("user_id", userId).eq("channel", "whatsapp").not("verified_at", "is", null).maybeSingle(),
  ]);
  return { push: profile?.notify_push ?? true, whatsapp: link?.external_id ?? null, lastInbound: link?.last_inbound_at ? new Date(link.last_inbound_at) : null };
}

async function send(userId: string, source: "reminder" | "briefing", sourceId: string | null, keyBase: string,
  { template, ...msg }: { title: string; body: string; url: string; whatsappText: string; template: Proactive }) {
  const ch = await channelsFor(userId);
  const wa = whatsapp();
  if (ch.push && (await claim(userId, source, sourceId, "push", `${keyBase}:push`, msg))) {
    try { await sendPush(userId, msg); await finish(`${keyBase}:push`, null); } catch (e) { await finish(`${keyBase}:push`, String(e)); }
  }
  if (ch.whatsapp && wa && (await claim(userId, source, sourceId, "whatsapp", `${keyBase}:whatsapp`, msg))) {
    try { await wa.sendProactive(ch.whatsapp, { ...template, text: msg.whatsappText }, ch.lastInbound); await finish(`${keyBase}:whatsapp`, null); }
    catch (e) { await finish(`${keyBase}:whatsapp`, String(e)); }
  }
}

export async function deliverDueReminders(now = new Date()) {
  const db = getAdmin();
  const { data } = await db.from("reminders").select("id, user_id, title, next_fire_at, last_fired_at, timezone, recurrence_rule")
    .eq("status", "active").lte("next_fire_at", now.toISOString()).order("next_fire_at").limit(200);
  let count = 0;
  for (const r of data ?? []) {
    if (r.last_fired_at && r.last_fired_at >= r.next_fire_at!) continue;  // já avisado nesta ocorrência
    const time = formatTime(r.next_fire_at!, r.timezone);
    await send(r.user_id, "reminder", r.id, `reminder:${r.id}:${r.next_fire_at}`, {
      title: "Lembrete", body: `${r.title} · ${time}`, url: "/lembretes", whatsappText: `⏰ Lembrete: ${r.title} (${time})`,
      template: { template: "lembrete", params: [r.title, time], text: "" },
    });
    // recorrente: já fica marcado para a próxima ocorrência
    const next = r.recurrence_rule ? nextFireAt(r.recurrence_rule, r.next_fire_at!, r.timezone, now) : null;
    await db.from("reminders").update({ last_fired_at: now.toISOString(), ...(next ? { next_fire_at: next } : {}) }).eq("id", r.id).eq("user_id", r.user_id);
    await db.from("notices").insert({ user_id: r.user_id, kind: "reminder", title: "Lembrete", body: r.title, href: "/lembretes" });
    count++;
  }
  return count;
}

// Resumo da manhã: de quem tem o horário dentro da janela da varredura (até 10 min de atraso)
export async function deliverBriefings(now = new Date()) {
  const db = getAdmin();
  const { data } = await db.from("profiles").select("user_id, timezone, briefing_time").eq("briefing_enabled", true);
  let count = 0;
  for (const p of data ?? []) {
    const parts = zonedParts(now, p.timezone);
    const minutesNow = parts.hour * 60 + parts.minute;
    const [h, m] = p.briefing_time.split(":").map(Number);
    if (minutesNow < h * 60 + m || minutesNow > h * 60 + m + 10) continue;
    const day = localDate(now, p.timezone);
    const key = `briefing:${p.user_id}:${day}`;
    const { data: already } = await db.from("scheduled_deliveries").select("id").like("dedupe_key", `${key}:%`).limit(1);
    if (already?.length) continue;
    const store = await storeForUser(p.user_id);
    const [settings, reminders, tasks, habits, logs, events, recurrences, transactions, categories] = await Promise.all([
      store.getSettings(), store.listReminders(), store.listTasks(), store.listHabits(), store.listHabitLogs(), store.listEvents(),
      store.listRecurrences(), store.listTransactions(), store.listCategories(),
    ]);
    const spending = variableSpending(transactions, categories, day.slice(0, 7), day);
    const b = buildBriefing({ name: settings.name, hour: parts.hour, today: day, recurrences,
      items: dayItems({ reminders, tasks, habits, logs, events, now, tz: p.timezone }),
      monthSpentCents: spending.totalCents, lastMonthSamePeriodCents: spending.previousMonthCents });
    const text = [b.greeting, b.summary, ...b.sections.map((s) => `*${s.title}*\n${s.lines.map((l) => `• ${l}`).join("\n")}`)].join("\n\n");
    await send(p.user_id, "briefing", null, key, { title: "Seu dia", body: b.summary, url: "/briefing", whatsappText: text,
      template: { template: "resumo", params: [b.summary], text: "" } });
    await db.from("notices").insert({ user_id: p.user_id, kind: "briefing", title: "Seu dia", body: b.summary, href: "/briefing" });
    count++;
  }
  return count;
}

// F6: "testar aviso agora". Manda pelos canais ligados e diz o que aconteceu em cada um,
// para a pessoa descobrir hoje (e não na hora do remédio) que o celular está bloqueando.
export type TestResult = { push: "sent" | "no-device" | "off" | "not-configured"; devices: number; whatsapp: "sent" | "not-linked" | "error" | "not-configured"; number: string | null };

export async function sendTestNotice(userId: string): Promise<TestResult> {
  const ch = await channelsFor(userId);
  const msg = { title: "Aviso de teste", body: "Se você está vendo isto, os lembretes chegam aqui.", url: "/avisos" };
  let push: TestResult["push"] = "off", devices = 0;
  if (!pushEnabled()) push = "not-configured";
  else if (ch.push) { devices = await sendPush(userId, msg); push = devices > 0 ? "sent" : "no-device"; }
  const wa = whatsapp();
  let whatsappStatus: TestResult["whatsapp"] = !wa ? "not-configured" : ch.whatsapp ? "sent" : "not-linked";
  if (wa && ch.whatsapp) {
    const text = "🔔 Aviso de teste: se você está vendo isto, os lembretes chegam aqui no WhatsApp.";
    try { await wa.sendProactive(ch.whatsapp, { template: "aviso", params: ["teste de aviso: se você está vendo isto, os lembretes chegam aqui no WhatsApp"], text }, ch.lastInbound); }
    catch { whatsappStatus = "error"; }
  }
  await getAdmin().from("notices").insert({ user_id: userId, kind: "system", title: msg.title, body: msg.body, href: "/avisos" });
  return { push, devices, whatsapp: whatsappStatus, number: ch.whatsapp };
}

// Revisão agendada pronta: vai para os Avisos sempre e pelo canal escolhido. Se o WhatsApp ou o e-mail
// não estiver pronto, cai no aviso do celular. Devolve o que aconteceu, para o registro da execução.
const oneLine = (text: string) => text.replace(/\s*\n+\s*/g, " · ").trim();
const firstLine = (text: string, max: number) => { const l = text.split("\n").find((x) => x.trim()) ?? ""; return l.length > max ? `${l.slice(0, max - 1)}…` : l; };

export async function deliverReview(userId: string, automationId: string, scheduledFor: string, channel: "push" | "whatsapp" | "email", { title, text }: { title: string; text: string }) {
  const db = getAdmin();
  const key = `automation:${automationId}:${scheduledFor}`;
  const msg = { title, body: firstLine(text, 140), url: "/avisos" };
  const notes: string[] = [];
  await db.from("notices").insert({ user_id: userId, kind: "automation", title: title.slice(0, 120), body: text, href: "/avisos" });
  const ch = await channelsFor(userId);
  let via: Channel = channel;

  if (channel === "whatsapp") {
    const wa = whatsapp();
    if (ch.whatsapp && wa) {
      if (await claim(userId, "automation", automationId, "whatsapp", `${key}:whatsapp`, { text })) {
        try { await wa.sendProactive(ch.whatsapp, { template: "resumo", params: [oneLine(`${title}: ${text}`)], text: `*${title}*\n${text}` }, ch.lastInbound); await finish(`${key}:whatsapp`, null); }
        catch (e) { await finish(`${key}:whatsapp`, String(e)); notes.push("WhatsApp falhou"); via = "push"; }
      }
    } else { notes.push("WhatsApp não vinculado"); via = "push"; }
  } else if (channel === "email") {
    const { data } = await db.auth.admin.getUserById(userId);
    if (data.user?.email && emailEnabled()) {
      if (await claim(userId, "automation", automationId, "email", `${key}:email`, { text })) {
        const ok = await sendEmail(data.user.email, title, text);
        await finish(`${key}:email`, ok ? null : "falhou");
        if (!ok) { notes.push("e-mail falhou"); via = "push"; }
      }
    } else { notes.push("e-mail indisponível"); via = "push"; }
  }

  if (via === "push" && ch.push && (await claim(userId, "automation", automationId, "push", `${key}:push`, msg))) {
    try { await sendPush(userId, msg); await finish(`${key}:push`, null); } catch (e) { await finish(`${key}:push`, String(e)); }
  }
  return notes;
}
