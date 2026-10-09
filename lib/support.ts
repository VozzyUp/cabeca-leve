import { noticeNumbers } from "@/lib/whatsapp/link";
import crypto from "node:crypto";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { getAdmin } from "@/lib/supabase/server";
import { whatsapp } from "@/lib/whatsapp/provider";
import { siteUrl } from "@/lib/public-env";

// F3 do replica/fixes.md: falar com uma pessoa. O chamado tem protocolo e prazo visíveis,
// avisa o dono do app na hora (e-mail e WhatsApp) e a resposta volta pelo app, WhatsApp e e-mail.

const SITE = siteUrl;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";  // sem 0/O e 1/I/L, para ditar sem erro

export function newProtocol() {
  const bytes = crypto.randomBytes(6);
  return `CL-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

// Prazo prometido: 1 dia útil. Sábado e domingo empurram para segunda no mesmo horário.
export function supportDueAt(now = new Date()) {
  const due = new Date(now.getTime() + 24 * 3_600_000);
  const weekday = () => new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(due);
  while (weekday() === "Sat" || weekday() === "Sun") due.setTime(due.getTime() + 24 * 3_600_000);
  return due;
}

export const formatDue = (iso: string, tz = "America/Sao_Paulo") =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const isSupportAdmin = (email: string | null | undefined) =>
  !!email && (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

// Avisa o dono do app. Falha de envio não derruba o chamado: ele já está gravado e aparece no painel.
export async function notifyOwner(t: { protocol: string; message: string; channel: string; dueAt: string; userEmail: string | null }) {
  const text = `Novo chamado ${t.protocol} (${t.channel}) de ${t.userEmail ?? "sem e-mail"}\nPrazo: ${formatDue(t.dueAt)}\n\n${t.message}\n\nResponder: ${SITE()}/suporte/painel`;
  const jobs: Promise<unknown>[] = [];
  if (process.env.SUPPORT_EMAIL) jobs.push(sendEmail(process.env.SUPPORT_EMAIL, `[${BRAND.name}] Chamado ${t.protocol}`, text));
  const wa = whatsapp();
  if (wa && process.env.SUPPORT_WHATSAPP) jobs.push(wa.sendProactive(process.env.SUPPORT_WHATSAPP, { template: "aviso", params: [`novo chamado ${t.protocol}, prazo ${formatDue(t.dueAt)}`], text }, null));
  await Promise.allSettled(jobs);
}

// Resposta do time: grava, avisa a pessoa no app, no WhatsApp (se vinculado) e por e-mail
export async function answerTicket(ticketId: string, reply: string, by: string) {
  const db = getAdmin();
  const { data: t, error } = await db.from("support_tickets").update({ reply, status: "answered", answered_at: new Date().toISOString(), answered_by: by })
    .eq("id", ticketId).eq("status", "open").select("user_id, protocol").maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return false;  // já respondido
  await db.from("notices").insert({ user_id: t.user_id, kind: "support", title: `Resposta do suporte (${t.protocol})`, body: reply, href: "/ajustes/suporte" });
  const [numbers, { data: user }] = await Promise.all([noticeNumbers(t.user_id), db.auth.admin.getUserById(t.user_id)]);
  const text = `Resposta do suporte do ${BRAND.name} (protocolo ${t.protocol}):\n\n${reply}`;
  const wa = whatsapp();
  await Promise.allSettled([
    ...(wa ? numbers : []).map((n) => wa!.sendProactive(n.number, { template: "aviso", params: [`resposta do suporte ao chamado ${t.protocol}: ${reply}`], text }, n.lastInbound)),
    sendEmail(user.user?.email ?? "", `${BRAND.name}: resposta ao chamado ${t.protocol}`, text),
  ]);
  return true;
}
