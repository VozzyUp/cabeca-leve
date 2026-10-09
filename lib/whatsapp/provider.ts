import crypto from "node:crypto";
import { digitsOnly } from "./phone";

// Canal WhatsApp atrás de uma interface: hoje a UAZAPI, depois a WhatsApp Cloud API
// oficial da Meta. Trocar é mudar WHATSAPP_PROVIDER; nada fora desta pasta muda.

export type Inbound = {
  externalId: string;            // id da mensagem no provedor (deduplicação)
  from: string;                  // número em dígitos, com DDI
  text: string | null;
  audio: { ref: string } | null; // referência para baixar o áudio depois, na fila
  image?: { ref: string; caption: string | null } | null;  // foto (comprovante, fatura...): baixada e reduzida na fila
  button?: { id: string } | null;  // a pessoa tocou num botão que mandamos (o id é o que demos ao botão)
  at: Date;
};

// Botão de resposta rápida: o título aparece no botão (até 20 caracteres) e o id volta quando a pessoa toca
export type Button = { id: string; title: string };

export type Proactive = {
  template: "lembrete" | "resumo" | "aviso";
  params: string[];  // variáveis do modelo, na ordem ({{1}}, {{2}}…), cada uma numa linha só
  text: string;      // o mesmo conteúdo em texto livre, para dentro da janela e para a UAZAPI
};

// Nomes dos modelos aprovados no Gerenciador do WhatsApp (textos sugeridos em replica/backend.md)
const TEMPLATE_ENV = { lembrete: "META_TEMPLATE_LEMBRETE", resumo: "META_TEMPLATE_RESUMO", aviso: "META_TEMPLATE_AVISO" } as const;
const WINDOW_MS = 24 * 3_600_000;

export interface WhatsAppProvider {
  name: "uazapi" | "meta";
  // confere se o pedido veio mesmo do provedor (segredo, token ou assinatura)
  verifyWebhook(req: { url: string; headers: Headers; rawBody: string }): boolean;
  parseWebhook(body: unknown): Inbound[];
  sendText(to: string, text: string): Promise<void>;
  // mensagem que a pessoa não pediu agora (lembrete, resumo, aviso). Na Meta, fora da janela de
  // 24 h desde a última mensagem dela, só sai por modelo aprovado; dentro da janela, texto livre.
  sendProactive(to: string, msg: Proactive, lastInboundAt: Date | null, buttons?: Button[]): Promise<void>;
  // texto com até 3 botões de resposta; quem chama usa sendReply, que volta ao texto simples se der erro
  sendButtons(to: string, text: string, buttons: Button[]): Promise<void>;
  downloadAudio(ref: string): Promise<{ data: ArrayBuffer; mimeType: string }>;
  downloadImage(ref: string): Promise<{ data: ArrayBuffer; mimeType: string }>;
}

// WHATSAPP_BUTTONS (tela de admin): "button" (formato atual, padrão), "button_legacy" (formato antigo da UAZAPI) ou "off"
export const buttonMode = () => (process.env.WHATSAPP_BUTTONS === "off" || process.env.WHATSAPP_BUTTONS === "button_legacy" ? process.env.WHATSAPP_BUTTONS : "button");
export const buttonsEnabled = () => buttonMode() !== "off";

// No máximo 3 botões, título de até 20 caracteres, sem "|" (a UAZAPI usa como separador) e ids sem quebra de linha
export function cleanButtons(buttons: Button[]): Button[] {
  return buttons.slice(0, 3).map((b) => ({
    id: b.id.replace(/[|\n\r]/g, "").slice(0, 200),
    title: b.title.replace(/\|/g, "/").replace(/\s+/g, " ").trim().slice(0, 20),
  })).filter((b) => b.id && b.title);
}

// Resposta com botões; se os botões estiverem desligados ou o envio falhar, vai o texto sozinho (nunca perde a resposta)
export async function sendReply(wa: WhatsAppProvider, to: string, text: string, buttons: Button[] = []) {
  const clean = buttonsEnabled() ? cleanButtons(buttons) : [];
  if (!clean.length) return wa.sendText(to, text);
  try { await wa.sendButtons(to, text, clean); }
  catch (error) {
    console.error("botões do WhatsApp falharam, enviando só o texto", (error as Error).message);
    await wa.sendText(to, text);
  }
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
  const download = async (ref: string, extra: Record<string, unknown>, fallbackType: string) => {
    const res = await ok(await fetch(`${base}/message/download`, { method: "POST", headers, body: JSON.stringify({ id: ref, ...extra }) }), "uazapi download");
    const { fileURL, mimetype } = (await res.json()) as { fileURL: string; mimetype?: string };
    const file = await ok(await fetch(fileURL), "uazapi fileURL");
    return { data: await file.arrayBuffer(), mimeType: mimetype ?? file.headers.get("content-type") ?? fallbackType };
  };
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
      const isImage = /image/i.test(type);  // figurinha (sticker) não entra
      const text = typeof m.text === "string" && m.text.trim() ? m.text.trim() : null;
      const buttonId = typeof m.buttonOrListid === "string" && m.buttonOrListid.trim() ? m.buttonOrListid.trim() : null;
      if (!text && !isAudio && !isImage && !buttonId) return [];
      const id = String(m.messageid ?? m.id ?? "");
      return [{ externalId: id, from: digitsOnly(jid.split("@")[0]), text: isAudio || isImage ? null : text, button: buttonId ? { id: buttonId } : null,
        audio: isAudio ? { ref: String(m.id ?? id) } : null, image: isImage ? { ref: String(m.id ?? id), caption: text } : null,
        at: new Date(Number(m.messageTimestamp) || Date.now()) }];
    },
    async sendText(to, text) {
      await ok(await fetch(`${base}/send/text`, { method: "POST", headers, body: JSON.stringify({ number: digitsOnly(to), text, linkPreview: false }) }), "uazapi send/text");
    },
    async sendButtons(to, text, buttons) {
      // "texto|id" por botão. O formato "button" é o atual; "button_legacy" só cria botões de resposta, no formato antigo
      await ok(await fetch(`${base}/send/menu`, { method: "POST", headers, body: JSON.stringify({
        number: digitsOnly(to), type: buttonMode() === "button_legacy" ? "button_legacy" : "button", text, choices: buttons.map((b) => `${b.title}|${b.id}`),
      }) }), "uazapi send/menu");
    },
    async sendProactive(to, msg, _lastInboundAt, buttons) {
      // a UAZAPI não tem janela nem modelos: com botões, vai direto como mensagem de botões
      if (buttons?.length) return sendReply(this, to, msg.text, buttons);
      await this.sendText(to, msg.text);
    },
    async downloadAudio(ref) {
      return download(ref, { generate_mp3: true }, "audio/mpeg");
    },
    async downloadImage(ref) {
      return download(ref, {}, "image/jpeg");
    },
  };
}

// ---- WhatsApp Cloud API (Meta, v24.0) ----
function meta(): WhatsAppProvider {
  const token = process.env.META_WHATSAPP_TOKEN ?? "";
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  const graph = (process.env.META_GRAPH_URL ?? "https://graph.facebook.com/v24.0").replace(/\/$/, "");
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
        const image = type === "image" ? (m.image as { id: string; caption?: string }) : null;
        const reply = type === "interactive" ? (m.interactive as { button_reply?: { id: string; title?: string }; list_reply?: { id: string; title?: string } }) : null;
        const picked = reply?.button_reply ?? reply?.list_reply ?? null;
        if (!text && !audio && !image && !picked) continue;
        out.push({ externalId: String(m.id), from: digitsOnly(String(m.from)), text: text || picked?.title || null, button: picked ? { id: picked.id } : null, audio: audio ? { ref: audio.id } : null,
          image: image ? { ref: image.id, caption: image.caption?.trim() || null } : null, at: new Date(Number(m.timestamp) * 1000) });
      }
      return out;
    },
    async sendText(to, text) {
      await ok(await fetch(`${graph}/${phoneId}/messages`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: digitsOnly(to), type: "text", text: { body: text, preview_url: false } }),
      }), "meta messages");
    },
    async sendButtons(to, text, buttons) {
      await ok(await fetch(`${graph}/${phoneId}/messages`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: digitsOnly(to), type: "interactive",
          interactive: { type: "button", body: { text: text.slice(0, 1024) }, action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) } },
        }),
      }), "meta interactive");
    },
    async sendProactive(to, msg, lastInboundAt, buttons) {
      // dentro da janela de 24 h vale mensagem livre, com botões; fora dela só o modelo aprovado (sem botões)
      if (lastInboundAt && Date.now() - lastInboundAt.getTime() < WINDOW_MS) return buttons?.length ? sendReply(this, to, msg.text, buttons) : this.sendText(to, msg.text);
      const name = process.env[TEMPLATE_ENV[msg.template]];
      if (!name) throw new Error(`modelo da Meta não configurado: ${TEMPLATE_ENV[msg.template]}`);
      // a Meta recusa variável com quebra de linha, tabulação ou mais de 4 espaços seguidos
      const clean = (p: string) => p.replace(/[\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, 1000);
      await ok(await fetch(`${graph}/${phoneId}/messages`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: digitsOnly(to), type: "template",
          template: { name, language: { code: process.env.META_TEMPLATE_LANG ?? "pt_BR" },
            components: [{ type: "body", parameters: msg.params.map((p) => ({ type: "text", text: clean(p) })) }] },
        }),
      }), "meta template");
    },
    async downloadAudio(ref) {
      return this.downloadImage(ref);  // na Meta, áudio e foto baixam do mesmo jeito (id da mídia)
    },
    async downloadImage(ref) {
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
