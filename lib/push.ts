import webpush from "web-push";
import { getAdmin } from "@/lib/supabase/server";

// Web Push (VAPID): chega com o app fechado. No iPhone, só com o app instalado na tela inicial.
export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export async function sendPush(userId: string, payload: { title: string; body: string; url: string }) {
  if (!pushEnabled()) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@exemplo.com.br", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
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
