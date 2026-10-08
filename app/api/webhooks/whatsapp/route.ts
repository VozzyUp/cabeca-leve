import { enqueue } from "@/lib/queue";
import { processInbound } from "@/lib/whatsapp/inbound";
import { whatsapp } from "@/lib/whatsapp/provider";

// Verificação do webhook pela Meta (só no provedor oficial)
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) return new Response(p.get("hub.challenge") ?? "");
  return new Response("forbidden", { status: 403 });
}

// Mensagens do WhatsApp: confere a origem, responde 200 na hora e manda o trabalho para a fila
export async function POST(request: Request) {
  const wa = whatsapp();
  if (!wa) return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  const rawBody = await request.text();
  if (!wa.verifyWebhook({ url: request.url, headers: request.headers, rawBody })) return new Response("forbidden", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }
  for (const msg of wa.parseWebhook(body)) {
    await enqueue("/api/jobs/process-inbound", msg, () => processInbound(msg));
  }
  return Response.json({ ok: true });
}
