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
  const sent: Array<{ number: string; text: string; type?: string; choices?: string[] }> = [];
  let menuStatus = 200;  // 500 simula a UAZAPI recusar os botões
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
        if (req.url === "/send/menu") {
          if (menuStatus !== 200) { res.statusCode = menuStatus; return res.end("{}"); }
          sent.push(JSON.parse(data)); return res.end("{}");
        }
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

  it("o que o assistente registra vem com Desfazer e Alterar; tocar em Desfazer desfaz, e o toque repetido não faz de novo", async () => {
    const { processInbound } = await import("./inbound");
    const { whatsapp } = await import("./provider");
    await processInbound(inbound("B1", "gastei 31 na farmácia"));
    const msg = sent.at(-1)!;
    expect(msg.type).toBe("button");
    expect(msg.text).toMatch(/✅ Lançamento: Farmácia/);
    expect(msg.choices).toEqual([expect.stringMatching(/^↩️ Desfazer\|u:[0-9a-f-]{36}$/), expect.stringMatching(/^✏️ Alterar\|a:[0-9a-f-]{36}$/)]);
    const undoId = msg.choices![0].split("|")[1];
    const { data: before } = await admin.from("transactions").select("id").eq("user_id", userId).eq("description", "Farmácia");
    expect(before).toHaveLength(1);

    // o webhook entende o toque
    const click = (id: string, mid: string) => ({ EventType: "messages", message: { messageid: mid, id: mid, chatid: `${fromWithout9}@s.whatsapp.net`, fromMe: false, isGroup: false, messageType: "ButtonsResponseMessage", text: "↩️ Desfazer", buttonOrListid: id, messageTimestamp: Date.now() } });
    const parsed = whatsapp()!.parseWebhook(click(undoId, "BC1"));
    expect(parsed).toEqual([expect.objectContaining({ button: { id: undoId }, text: "↩️ Desfazer" })]);

    await processInbound(parsed[0]);
    expect(sent.at(-1)!.text).toBe("↩️ Pronto, desfiz.");
    const { data: after } = await admin.from("transactions").select("id").eq("user_id", userId).eq("description", "Farmácia");
    expect(after).toHaveLength(0);
    const count = sent.length;
    await processInbound(parsed[0]);  // o provedor reenviou o mesmo toque
    expect(sent.length).toBe(count);
    await processInbound({ ...parsed[0], externalId: "BC2" });  // outro toque no mesmo botão
    expect(sent.at(-1)!.text).toBe("Isso já estava desfeito.");
  });

  it("Alterar volta para a conversa como mensagem da pessoa; botão de outra conta ou inventado não faz nada", async () => {
    const { processInbound } = await import("./inbound");
    await processInbound(inbound("B2", "gastei 12 no estacionamento"));
    const altId = sent.at(-1)!.choices![1].split("|")[1];
    await processInbound({ externalId: "BA1", from: fromWithout9, text: "✏️ Alterar", audio: null, button: { id: altId }, at: new Date() });
    const { data } = await admin.from("messages").select("text_preview").eq("user_id", userId).eq("role", "user").order("created_at");
    expect(data!.at(-1)!.text_preview).toBe("Quero alterar o que você acabou de registrar.");

    await processInbound({ externalId: "BX1", from: fromWithout9, text: "?", audio: null, button: { id: "u:00000000-0000-0000-0000-000000000000" }, at: new Date() });
    expect(sent.at(-1)!.text).toBe("Isso já estava desfeito.");
    await processInbound({ externalId: "BX2", from: fromWithout9, text: "?", audio: null, button: { id: "zzz:1" }, at: new Date() });
    expect(sent.at(-1)!.text).toMatch(/não vale mais/);
  });

  it("lembrete: Feito conclui; Adiar oferece 10 minutos, 1 hora e amanhã, e cria o lembrete novo sem mexer na repetição", async () => {
    const { processInbound } = await import("./inbound");
    const mk = async (title: string, rule: string | null = null) =>
      (await admin.from("reminders").insert({ user_id: userId, title, next_fire_at: new Date(Date.now() + 3_600_000).toISOString(), timezone: "America/Sao_Paulo", recurrence_rule: rule }).select("id").single()).data!.id;
    const click = (id: string, mid: string) => processInbound({ externalId: mid, from: fromWithout9, text: "x", audio: null, button: { id }, at: new Date() });

    const a = await mk("Pagar o boleto");
    await click(`r:d:${a}`, "R1");
    expect(sent.at(-1)!.text).toBe("✅ Feito: “Pagar o boleto”.");
    expect((await admin.from("reminders").select("status").eq("id", a).single()).data!.status).toBe("done");

    const b = await mk("Ligar para o dentista");
    await click(`r:s:${b}`, "R2");
    expect(sent.at(-1)!.text).toBe("Adiar “Ligar para o dentista” para quando?");
    expect(sent.at(-1)!.choices).toEqual([`10 minutos|r:m10:${b}`, `1 hora|r:h1:${b}`, `Amanhã às 9h|r:tm:${b}`]);
    await click(`r:m10:${b}`, "R3");
    expect(sent.at(-1)!.text).toMatch(/^⏰ Adiado: “Ligar para o dentista” para hoje, \d{2}:\d{2}\.$/);
    const copies = (await admin.from("reminders").select("id, status, next_fire_at").eq("user_id", userId).eq("title", "Ligar para o dentista")).data!;
    expect(copies).toHaveLength(2);
    expect(copies.find((c) => c.id === b)!.status).toBe("done");  // o original sai; o novo vale
    const novo = copies.find((c) => c.id !== b)!;
    expect(novo.status).toBe("active");
    expect(new Date(novo.next_fire_at!).getTime() - Date.now()).toBeGreaterThan(8 * 60_000);
    expect(new Date(novo.next_fire_at!).getTime() - Date.now()).toBeLessThan(11 * 60_000);

    // lembrete que se repete: o original continua como está (a repetição não muda de horário)
    const c = await mk("Tomar o remédio", "FREQ=DAILY;INTERVAL=1");
    await click(`r:tm:${c}`, "R4");
    const original = (await admin.from("reminders").select("status, next_fire_at").eq("id", c).single()).data!;
    expect(original.status).toBe("active");
    const tomorrow = (await admin.from("reminders").select("next_fire_at").eq("user_id", userId).eq("title", "Tomar o remédio").neq("id", c)).data!;
    expect(tomorrow).toHaveLength(1);
    expect(new Date(tomorrow[0].next_fire_at!).toISOString()).toMatch(/T12:00:00\.000Z$/);  // 9h em São Paulo
    await click(`r:d:${c}`, "R5");
    expect(sent.at(-1)!.text).toMatch(/Anotado: “Tomar o remédio”/);
    expect((await admin.from("reminders").select("status").eq("id", c).single()).data!.status).toBe("active");
  });

  it("se a UAZAPI recusar os botões, a resposta vai só em texto; com os botões desligados também", async () => {
    const { processInbound } = await import("./inbound");
    menuStatus = 500;
    try {
      const before = sent.length;
      await processInbound(inbound("B3", "gastei 9 no pão"));
      expect(sent.length).toBe(before + 1);
      expect(sent.at(-1)!.choices).toBeUndefined();
      expect(sent.at(-1)!.text).toMatch(/✅ Lançamento: Pão/);
    } finally { menuStatus = 200; }
    process.env.WHATSAPP_BUTTONS = "off";
    try {
      await processInbound(inbound("B4", "gastei 8 no sorvete"));
      expect(sent.at(-1)!.choices).toBeUndefined();
      expect(sent.at(-1)!.text).toMatch(/✅ Lançamento: Sorvete/);
    } finally { delete process.env.WHATSAPP_BUTTONS; }
    process.env.WHATSAPP_BUTTONS = "button_legacy";
    try {
      await processInbound(inbound("B5", "gastei 7 no suco"));
      expect(sent.at(-1)!.type).toBe("button_legacy");
    } finally { delete process.env.WHATSAPP_BUTTONS; }
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

  it("conta dividida: segundo número só dentro do limite, fala com a mesma conta e cada número escolhe se recebe os avisos", async () => {
    const { LinkLimitError, startLink } = await import("./link");
    const { processInbound } = await import("./inbound");
    const { deliverDueReminders } = await import("@/lib/deliveries");
    const second = "+5511912340000";
    // o plano permite 1: o segundo número é recusado
    await expect(startLink(userId, second, { label: "Ana", limit: 1 })).rejects.toBeInstanceOf(LinkLimitError);
    // pedir de novo o número já vinculado não conta no limite (só atualiza o nome)
    expect(await startLink(userId, number, { label: "Fernando", limit: 1 })).toMatchObject({ alreadyLinked: true, code: null });
    // com 2, vincula pelo código mandado do próprio número
    const r = await startLink(userId, second, { label: "Ana", limit: 2 });
    await processInbound(inbound("D1", `Meu código: ${r.code}`, "5511912340000"));
    expect(sent.at(-1)).toMatchObject({ number: "5511912340000", text: expect.stringMatching(/Pronto!/) });
    const { data: links } = await admin.from("channel_links").select("external_id, label, verified_at").eq("user_id", userId).order("created_at");
    // o primeiro foi confirmado sem o 9 e fica gravado como chegou
    expect(links!.map((l) => [l.external_id, l.label, !!l.verified_at])).toEqual([[`+${fromWithout9}`, "Fernando", true], [second, "Ana", true]]);
    await expect(startLink(userId, "+5511955550000", { limit: 2 })).rejects.toBeInstanceOf(LinkLimitError);

    // a Ana lança pelo número dela: entra na mesma conta e a resposta volta para ela
    const before = (await admin.from("transactions").select("id").eq("user_id", userId)).data!.length;
    await processInbound(inbound("D2", "gastei 12 no pão", "5511912340000"));
    expect(sent.at(-1)!.number).toBe("5511912340000");
    expect((await admin.from("transactions").select("id").eq("user_id", userId)).data!.length).toBe(before + 1);

    // lembrete: vai para os dois; com os avisos desligados num número, só para o outro
    const fire = async (title: string) => {
      await admin.from("reminders").insert({ user_id: userId, title, next_fire_at: new Date(Date.now() - 1000).toISOString(), timezone: "America/Sao_Paulo" });
      const n = sent.length;
      await deliverDueReminders();
      return sent.slice(n).filter((m) => String(m.text).includes(title)).map((m) => m.number).sort();
    };
    expect(await fire("Regar as plantas")).toEqual([fromWithout9, "5511912340000"].sort());
    await admin.from("channel_links").update({ receives_notices: false }).eq("user_id", userId).eq("external_id", `+${fromWithout9}`);
    expect(await fire("Comprar ração")).toEqual(["5511912340000"]);
  });
});
