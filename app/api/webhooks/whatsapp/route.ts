import { recordStatus } from "@/lib/diagnostics";
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
  if (!wa) {
    await recordStatus("whatsapp_webhook", "WhatsApp sem provedor configurado (faltam as chaves da UAZAPI ou da Meta)", false);
    return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }
  const rawBody = await request.text();
  if (!wa.verifyWebhook({ url: request.url, headers: request.headers, rawBody })) {
    await recordStatus("whatsapp_webhook", "Recusado: o segredo na URL do webhook ou o token da instância não batem com os do sistema", false);
    return new Response("forbidden", { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }
  const messages = wa.parseWebhook(body);
  try {
    for (const msg of messages) await enqueue("/api/jobs/process-inbound", msg, () => processInbound(msg));
  } catch (error) {
    await recordStatus("whatsapp_webhook", "Recebido, mas não entrou na fila (QStash)", false, (error as Error).message);
    throw error;
  }
  await recordStatus("whatsapp_webhook", messages.length ? `Recebido: ${messages.length} mensagem${messages.length === 1 ? "" : "s"} enviada${messages.length === 1 ? "" : "s"} para a fila` : "Recebido, mas não era uma mensagem de pessoa (ignorado: grupo, enviada por nós, status ou outro tipo)", true);
  return Response.json({ ok: true });
}
