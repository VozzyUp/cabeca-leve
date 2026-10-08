import { z } from "zod";
import { currentUser, getAdmin } from "@/lib/supabase/server";

const Sub = z.object({ endpoint: z.url().max(2000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

// Registra este navegador para receber notificações
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão expirada" }, { status: 401 });
  const parsed = Sub.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Inscrição inválida" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const { error } = await getAdmin().from("push_subscriptions").upsert({
    user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: request.headers.get("user-agent")?.slice(0, 300), last_seen_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  return error ? Response.json({ error: "Não deu para salvar" }, { status: 500 }) : Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão expirada" }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await getAdmin().from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
