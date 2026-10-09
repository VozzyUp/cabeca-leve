import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

// WhatsApp de ponta a ponta contra uma UAZAPI e uma Groq falsas e o Supabase local.
// SUPABASE_TEST=1 npx vitest run lib/whatsapp/whatsapp.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("WhatsApp (UAZAPI)", () => {
  const sent: Array<{ number: string; text: string }> = [];
  let server: http.Server;
  let base = "";
  let userId = "";
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  let png: Buffer = Buffer.alloc(0);
  const number = "+5511987650000";
  const fromWithout9 = "551187650000";  // o WhatsApp às vezes manda sem o 9

  beforeAll(async () => {
    png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#cc3333" } }).png().toBuffer();
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/send/text") { sent.push(JSON.parse(data)); return res.end("{}"); }
        if (req.url === "/message/download") {
          const photo = String((JSON.parse(data || "{}") as { id?: string }).id).startsWith("IMG");
          return res.end(JSON.stringify(photo ? { fileURL: `${base}/foto.png`, mimetype: "image/png" } : { fileURL: `${base}/file.mp3`, mimetype: "audio/mpeg" }));
        }
        if (req.url === "/foto.png") { res.setHeader("content-type", "image/png"); return res.end(png); }
        if (req.url === "/file.mp3") { res.setHeader("content-type", "audio/mpeg"); return res.end(Buffer.from("ID3fake")); }
        if (req.url === "/audio/transcriptions") return res.end(JSON.stringify({ text: "me lembra de ligar pra minha mãe amanhã às 10h" }));
        res.statusCode = 404; res.end("{}");
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), WHATSAPP_PROVIDER: "uazapi", UAZAPI_BASE_URL: base,
      UAZAPI_INSTANCE_TOKEN: "tok-instancia", UAZAPI_WEBHOOK_SECRET: "segredo", WHATSAPP_BOT_NUMBER: "5511900000000",
      GROQ_API_KEY: "teste", GROQ_API_URL: base,
    });
    delete process.env.ANTHROPIC_API_KEY;  // usa o intérprete de regras, sem gastar a chave
    const { data } = await admin.auth.admin.createUser({ email: `wa-${Date.now()}@teste.local`, password: "x".repeat(12), email_confirm: true });
    userId = data.user!.id;
  });
  afterAll(async () => {
    server.close();
    await admin.auth.admin.deleteUser(userId);
  });

  const inbound = (id: string, text: string | null, from = fromWithout9, audio = false) =>
    ({ externalId: id, from, text, audio: audio ? { ref: id } : null, at: new Date() });

  it("o webhook só aceita o segredo e o token certos", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    const body = JSON.stringify({ EventType: "messages", token: "tok-instancia", message: { messageid: "M1", chatid: `${fromWithout9}@s.whatsapp.net`, fromMe: false, isGroup: false, messageType: "Conversation", text: "oi" } });
    expect(wa.verifyWebhook({ url: "http://x/api/webhooks/whatsapp?secret=segredo", headers: new Headers(), rawBody: body })).toBe(true);
    expect(wa.verifyWebhook({ url: "http://x/api/webhooks/whatsapp?secret=errado", headers: new Headers(), rawBody: body })).toBe(false);
    expect(wa.verifyWebhook({ url: "http://x/api/webhooks/whatsapp?secret=segredo", headers: new Headers(), rawBody: body.replace("tok-instancia", "outro") })).toBe(false);
    expect(wa.parseWebhook(JSON.parse(body))).toEqual([expect.objectContaining({ externalId: "M1", from: fromWithout9, text: "oi" })]);
    expect(wa.parseWebhook({ EventType: "messages", message: { fromMe: true, chatid: "1@s.whatsapp.net", text: "eco" } })).toEqual([]);
  });

  it("número desconhecido recebe a explicação de como vincular", async () => {
    const { processInbound } = await import("./inbound");
    await processInbound(inbound("U1", "oi", "5521999990000"));
    expect(sent.at(-1)!.text).toMatch(/ainda não está ligado/);
  });

  it("vincula pelo código, mesmo com o número chegando sem o 9", async () => {
    const { startLink } = await import("./link");
    const { processInbound } = await import("./inbound");
    const { code, link } = await startLink(userId, number);
    expect(link).toContain(`wa.me/5511900000000?text=`);
    await processInbound(inbound("L0", "Meu código: 000000"));  // código errado
    expect(sent.at(-1)!.text).toMatch(/ainda não está ligado/);
    await processInbound(inbound("L1", `Meu código: ${code}`));
    expect(sent.at(-1)!.text).toMatch(/Pronto!/);
    const { data } = await admin.from("channel_links").select("verified_at").eq("user_id", userId).single();
    expect(data!.verified_at).toBeTruthy();
  });

  it("mensagem de texto vira lançamento e a resposta lista o que foi salvo", async () => {
    const { processInbound } = await import("./inbound");
    await processInbound(inbound("T1", "gastei 20 no café"));
    expect(sent.at(-1)!.number).toBe(fromWithout9);
    expect(sent.at(-1)!.text).toMatch(/✅ Lançamento: .*R\$\s20,00/);
    const before = sent.length;
    await processInbound(inbound("T1", "gastei 20 no café"));  // o provedor reenviou
    expect(sent.length).toBe(before);
    const { data } = await admin.from("transactions").select("id").eq("user_id", userId);
    expect(data).toHaveLength(1);
  });

  it("foto chega com legenda: baixa, reduz e segue; sem IA ligada a resposta explica; formato inválido é recusado", async () => {
    const { whatsapp } = await import("./provider");
    const { processInbound } = await import("./inbound");
    // o webhook entende foto (e ignora figurinha)
    const wa = whatsapp()!;
    const hook = (messageType: string, extra: object) => ({ EventType: "messages", message: { messageid: "P1", id: "IMG-P1", chatid: `${fromWithout9}@s.whatsapp.net`, fromMe: false, isGroup: false, messageType, messageTimestamp: 1760000000000, ...extra } });
    expect(wa.parseWebhook(hook("ImageMessage", { text: "comprovante do mercado" }))).toEqual([expect.objectContaining({ text: null, audio: null, image: { ref: "IMG-P1", caption: "comprovante do mercado" } })]);
    expect(wa.parseWebhook(hook("StickerMessage", {}))).toEqual([]);

    const before = sent.length;
    await processInbound({ externalId: "P2", from: fromWithout9, text: null, audio: null, image: { ref: "IMG-P2", caption: "comprovante do mercado" }, at: new Date() });
    expect(sent.length).toBe(before + 1);
    expect(sent.at(-1)!.text).toMatch(/Ainda não leio fotos/);
    const { data: msgs } = await admin.from("messages").select("role, text_preview, content").eq("user_id", userId).order("seq", { ascending: false }).limit(2);
    const user = msgs!.find((m) => m.role === "user")!;
    expect(user.text_preview).toContain("📷 comprovante do mercado");
  });

  it("áudio é transcrito e processado", async () => {
    const { processInbound } = await import("./inbound");
    await processInbound(inbound("A1", null, fromWithout9, true));
    expect(sent.at(-1)!.text).toMatch(/✅ Lembrete: .*10:00/);
    const { data } = await admin.from("messages").select("text_preview, channel").eq("user_id", userId).eq("role", "user").order("created_at");
    expect(data!.at(-1)).toEqual({ text_preview: "me lembra de ligar pra minha mãe amanhã às 10h", channel: "whatsapp" });
  });
});
