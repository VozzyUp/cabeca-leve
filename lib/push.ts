import webpush from "web-push";
import { serverPublicEnv, urlSafeKey } from "@/lib/public-env";
import { getAdmin } from "@/lib/supabase/server";

// Web Push (VAPID): chega com o app fechado. No iPhone, só com o app instalado na tela inicial.
export const pushEnabled = () => !!(serverPublicEnv().vapidPublicKey && process.env.VAPID_PRIVATE_KEY);

// O assunto VAPID precisa ser mailto: ou https:// de verdade: a Apple recusa o envio (403 BadJwtToken)
// com endereço de exemplo ou localhost. Sem VAPID_SUBJECT, usa o e-mail do suporte ou o endereço do site.
export function vapidSubject(env: Record<string, string | undefined> = process.env, site = serverPublicEnv().siteUrl) {
  const raw = (env.VAPID_SUBJECT ?? "").trim();
  if (raw) return /^(mailto:|https:\/\/)/.test(raw) ? raw : raw.includes("@") ? `mailto:${raw}` : raw;
  const email = (env.SUPPORT_EMAIL ?? env.LEGAL_CONTACT_EMAIL ?? "").trim();
  if (email.includes("@")) return `mailto:${email}`;
  return site.startsWith("https://") ? site : "mailto:contato@exemplo.com.br";
}

export async function sendPush(userId: string, payload: { title: string; body: string; url: string }) {
  if (!pushEnabled()) return 0;
  webpush.setVapidDetails(vapidSubject(), serverPublicEnv().vapidPublicKey!, urlSafeKey(process.env.VAPID_PRIVATE_KEY)!);
  const db = getAdmin();
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      // inscrição vencida ou removida no navegador: apaga
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push falhou", status);
    }
  }
  return sent;
}
