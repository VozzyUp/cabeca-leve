import crypto from "node:crypto";
import { getAdmin } from "@/lib/supabase/server";
import { digitsOnly, phoneVariants, toE164 } from "./phone";

// Vincular o WhatsApp à conta: o app mostra um código de 6 dígitos e um link wa.me com
// a mensagem pronta. Só quem tem o celular manda o código daquele número, então isso
// prova que o número é da pessoa. O código fica guardado só como hash, por 30 minutos.

const hash = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
const variants = (digits: string) => phoneVariants(digits).map(toE164);

export async function startLink(userId: string, number: string) {
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 30 * 60_000).toISOString();
  const db = getAdmin();
  const { error } = await db.from("channel_links").upsert({
    user_id: userId, channel: "whatsapp", external_id: toE164(number), verified_at: null,
    verification_code_hash: hash(code), verification_expires_at: expires,
  }, { onConflict: "user_id,channel" });
  if (error) throw new Error(error.message);
  const bot = digitsOnly(process.env.WHATSAPP_BOT_NUMBER ?? "");
  const text = encodeURIComponent(`Meu código: ${code}`);
  return { code, expiresAt: expires, link: bot ? `https://wa.me/${bot}?text=${text}` : null };
}

// Conta dona de um número já confirmado
export async function findUserByNumber(digits: string): Promise<string | null> {
  const { data } = await getAdmin().from("channel_links").select("user_id").eq("channel", "whatsapp")
    .in("external_id", variants(digits)).not("verified_at", "is", null).limit(1);
  return data?.[0]?.user_id ?? null;
}

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

export async function linkStatus(userId: string) {
  const { data } = await getAdmin().from("channel_links").select("external_id, verified_at").eq("user_id", userId).eq("channel", "whatsapp").maybeSingle();
  return data ? { number: data.external_id, verified: !!data.verified_at } : null;
}
