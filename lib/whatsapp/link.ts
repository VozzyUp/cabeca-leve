import crypto from "node:crypto";
import { getAdmin } from "@/lib/supabase/server";
import { digitsOnly, phoneVariants, toE164 } from "./phone";

// Vincular o WhatsApp à conta: o app mostra um código de 6 dígitos e um link wa.me com
// a mensagem pronta. Só quem tem o celular manda o código daquele número, então isso
// prova que o número é da pessoa. O código fica guardado só como hash, por 30 minutos.

const hash = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
const variants = (digits: string) => phoneVariants(digits).map(toE164);

// A conta já usa todos os números do plano
export class LinkLimitError extends Error {
  constructor(public limit: number) { super(`Seu plano permite ${limit} número${limit === 1 ? "" : "s"} de WhatsApp.`); }
}

// Começa (ou recomeça) o vínculo de um número. Pedir de novo um número da própria conta só
// renova o código; número novo conta no limite do plano (confirmados e aguardando código).
export async function startLink(userId: string, number: string, opts: { label?: string | null; limit?: number } = {}) {
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 30 * 60_000).toISOString();
  const db = getAdmin();
  const e164 = toE164(number);
  const { data: mine, error: listError } = await db.from("channel_links").select("id, external_id, verified_at").eq("user_id", userId).eq("channel", "whatsapp");
  if (listError) throw new Error(listError.message);
  // o mesmo número com ou sem o 9 (o WhatsApp às vezes confirma sem ele)
  const same = new Set(variants(digitsOnly(e164)));
  const existing = (mine ?? []).find((l) => same.has(l.external_id));
  if (existing?.verified_at) {
    // já confirmado: só atualiza o nome, sem código novo
    if (opts.label !== undefined) await db.from("channel_links").update({ label: opts.label }).eq("id", existing.id);
    return { code: null, expiresAt: null, link: null, alreadyLinked: true as const };
  }
  if (!existing && opts.limit !== undefined && (mine ?? []).length >= opts.limit) throw new LinkLimitError(opts.limit);
  const { error } = await db.from("channel_links").upsert({
    user_id: userId, channel: "whatsapp", external_id: existing?.external_id ?? e164, verified_at: null,
    verification_code_hash: hash(code), verification_expires_at: expires,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
  }, { onConflict: "user_id,channel,external_id" });
  if (error) throw new Error(error.message);
  const bot = digitsOnly(process.env.WHATSAPP_BOT_NUMBER ?? "");
  const text = encodeURIComponent(`Meu código: ${code}`);
  return { code, expiresAt: expires, link: bot ? `https://wa.me/${bot}?text=${text}` : null, alreadyLinked: false as const };
}

// Conta dona de um número já confirmado, e o nome de quem usa esse número
export async function findLinkByNumber(digits: string): Promise<{ userId: string; label: string | null } | null> {
  const { data } = await getAdmin().from("channel_links").select("user_id, label").eq("channel", "whatsapp")
    .in("external_id", variants(digits)).not("verified_at", "is", null).limit(1);
  return data?.[0] ? { userId: data[0].user_id, label: data[0].label } : null;
}
export const findUserByNumber = async (digits: string) => (await findLinkByNumber(digits))?.userId ?? null;

// Mensagem de um número ainda não confirmado: se trouxer o código certo, confirma
export async function tryVerify(digits: string, text: string): Promise<string | null> {
  const code = text.match(/\b(\d{6})\b/)?.[1];
  if (!code) return null;
  const db = getAdmin();
  const { data } = await db.from("channel_links").select("id, user_id, verification_code_hash, verification_expires_at")
    .eq("channel", "whatsapp").in("external_id", variants(digits)).is("verified_at", null);
  const match = (data ?? []).find((l) => l.verification_code_hash === hash(code) && l.verification_expires_at && l.verification_expires_at > new Date().toISOString());
  if (!match) return null;
  const { error } = await db.from("channel_links").update({
    verified_at: new Date().toISOString(), verification_code_hash: null, verification_expires_at: null, external_id: toE164(digits),
  }).eq("id", match.id);
  // índice único: o número já confirmado em outra conta não pode ser tomado
  return error ? null : match.user_id;
}

// Números da conta que recebem avisos (lembretes, resumo, respostas do suporte), com a janela de 24 h de cada um
export async function noticeNumbers(userId: string): Promise<Array<{ number: string; lastInbound: Date | null }>> {
  const { data } = await getAdmin().from("channel_links").select("external_id, last_inbound_at").eq("user_id", userId).eq("channel", "whatsapp")
    .not("verified_at", "is", null).eq("receives_notices", true).order("created_at");
  return (data ?? []).map((l) => ({ number: l.external_id, lastInbound: l.last_inbound_at ? new Date(l.last_inbound_at) : null }));
}
