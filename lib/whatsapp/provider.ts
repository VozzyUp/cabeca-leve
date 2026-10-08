import crypto from "node:crypto";
import { digitsOnly } from "./phone";

// Canal WhatsApp atrás de uma interface: hoje a UAZAPI, depois a WhatsApp Cloud API
// oficial da Meta. Trocar é mudar WHATSAPP_PROVIDER; nada fora desta pasta muda.

export type Inbound = {
  externalId: string;            // id da mensagem no provedor (deduplicação)
  from: string;                  // número em dígitos, com DDI
  text: string | null;
  audio: { ref: string } | null; // referência para baixar o áudio depois, na fila
  at: Date;
};

export interface WhatsAppProvider {
  name: "uazapi" | "meta";
  // confere se o pedido veio mesmo do provedor (segredo, token ou assinatura)
  verifyWebhook(req: { url: string; headers: Headers; rawBody: string }): boolean;
  parseWebhook(body: unknown): Inbound[];
  sendText(to: string, text: string): Promise<void>;
  downloadAudio(ref: string): Promise<{ data: ArrayBuffer; mimeType: string }>;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}

// ---- UAZAPI (https://docs.uazapi.com) ----
function uazapi(): WhatsAppProvider {
  const base = (process.env.UAZAPI_BASE_URL ?? "").replace(/\/$/, "");
  const token = process.env.UAZAPI_INSTANCE_TOKEN ?? "";
  const secret = process.env.UAZAPI_WEBHOOK_SECRET ?? "";
  const headers = { "Content-Type": "application/json", token };
  return {
    name: "uazapi",
    // a UAZAPI não assina o webhook: exigimos o segredo na URL E o token da instância no corpo
    verifyWebhook({ url, rawBody }) {
      if (!secret || !token) return false;
      const given = new URL(url).searchParams.get("secret") ?? "";
      let bodyToken = "";
      try { bodyToken = String((JSON.parse(rawBody) as { token?: unknown }).token ?? ""); } catch { return false; }
      return safeEqual(given, secret) && safeEqual(bodyToken, token);
    },
    parseWebhook(body) {
      const b = body as { EventType?: string; message?: Record<string, unknown> };
      const m = b.message;
      if (b.EventType !== "messages" || !m || m.fromMe || m.isGroup || m.wasSentByApi) return [];
      // o número vem no JID (5511...@s.whatsapp.net); com LID, o número real vem em sender_pn
      const jid = String(m.sender_pn || m.chatid || m.sender || "");
      if (!jid.endsWith("@s.whatsapp.net")) return [];
      const type = String(m.messageType ?? "");
      const isAudio = /audio|ptt/i.test(type);
      const text = typeof m.text === "string" && m.text.trim() ? m.text.trim() : null;
      if (!text && !isAudio) return [];
      const id = String(m.messageid ?? m.id ?? "");
      return [{ externalId: id, from: digitsOnly(jid.split("@")[0]), text: isAudio ? null : text,
        audio: isAudio ? { ref: String(m.id ?? id) } : null, at: new Date(Number(m.messageTimestamp) || Date.now()) }];
    },
    async sendText(to, text) {
      await ok(await fetch(`${base}/send/text`, { method: "POST", headers, body: JSON.stringify({ number: digitsOnly(to), text, linkPreview: false }) }), "uazapi send/text");
    },
    async downloadAudio(ref) {
      const res = await ok(await fetch(`${base}/message/download`, { method: "POST", headers, body: JSON.stringify({ id: ref, generate_mp3: true }) }), "uazapi download");
      const { fileURL, mimetype } = (await res.json()) as { fileURL: string; mimetype?: string };
      const file = await ok(await fetch(fileURL), "uazapi fileURL");
      return { data: await file.arrayBuffer(), mimeType: mimetype ?? file.headers.get("content-type") ?? "audio/mpeg" };
    },
  };
}

// ---- WhatsApp Cloud API (Meta, v24.0) ----
function meta(): WhatsAppProvider {
  const token = process.env.META_WHATSAPP_TOKEN ?? "";
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  const graph = "https://graph.facebook.com/v24.0";
  const auth = { Authorization: `Bearer ${token}` };
  return {
    name: "meta",
    // assinatura X-Hub-Signature-256: HMAC-SHA256 do corpo cru com o app secret
    verifyWebhook({ headers, rawBody }) {
      const sig = headers.get("x-hub-signature-256") ?? "";
      if (!appSecret || !sig.startsWith("sha256=")) return false;
      const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      return safeEqual(sig, expected);
    },
    parseWebhook(body) {
      const out: Inbound[] = [];
      const b = body as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }> };
      for (const e of b.entry ?? []) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) {
        const type = m.type as string;
        const text = type === "text" ? ((m.text as { body?: string })?.body ?? "").trim() : "";
        const audio = type === "audio" ? (m.audio as { id: string }) : null;
        if (!text && !audio) continue;
        out.push({ externalId: String(m.id), from: digitsOnly(String(m.from)), text: text || null, audio: audio ? { ref: audio.id } : null,
          at: new Date(Number(m.timestamp) * 1000) });
      }
      return out;
    },
    async sendText(to, text) {
      await ok(await fetch(`${graph}/${phoneId}/messages`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: digitsOnly(to), type: "text", text: { body: text, preview_url: false } }),
      }), "meta messages");
    },
    async downloadAudio(ref) {
      const info = (await (await ok(await fetch(`${graph}/${ref}`, { headers: auth }), "meta media")).json()) as { url: string; mime_type: string };
      const file = await ok(await fetch(info.url, { headers: auth }), "meta media file");
      return { data: await file.arrayBuffer(), mimeType: info.mime_type };
    },
  };
}

export function whatsapp(): WhatsAppProvider | null {
  const p = process.env.WHATSAPP_PROVIDER ?? "uazapi";
  if (p === "meta") return process.env.META_WHATSAPP_TOKEN ? meta() : null;
  return process.env.UAZAPI_BASE_URL && process.env.UAZAPI_INSTANCE_TOKEN ? uazapi() : null;
}
