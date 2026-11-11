import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Meta (F7): dentro da janela de 24 h, texto livre; fora dela, só modelo aprovado
describe("WhatsApp Cloud API da Meta: mensagens que a pessoa não pediu", () => {
  const bodies: Array<Record<string, unknown>> = [];
  let server: http.Server;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let d = ""; req.on("data", (c) => (d += c));
      req.on("end", () => { bodies.push(JSON.parse(d)); res.setHeader("content-type", "application/json"); res.end("{}"); });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      WHATSAPP_PROVIDER: "meta", META_WHATSAPP_TOKEN: "t", META_WHATSAPP_PHONE_NUMBER_ID: "123",
      META_GRAPH_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, META_TEMPLATE_LEMBRETE: "lembrete_v1",
    });
  });
  afterAll(() => { server.close(); delete process.env.WHATSAPP_PROVIDER; delete process.env.META_TEMPLATE_LEMBRETE; });

  it("com mensagem da pessoa há menos de 24 h, manda texto livre", async () => {
    const { whatsapp } = await import("./provider");
    await whatsapp()!.sendProactive("+55 11 99999-0000", { template: "lembrete", params: ["Remédio", "08:00"], text: "⏰ Lembrete: Remédio (08:00)" }, new Date(Date.now() - 3_600_000));
    expect(bodies.at(-1)).toMatchObject({ type: "text", to: "5511999990000", text: { body: "⏰ Lembrete: Remédio (08:00)" } });
  });

  it("fora da janela, manda o modelo aprovado, com variáveis numa linha só", async () => {
    const { whatsapp } = await import("./provider");
    await whatsapp()!.sendProactive("5511999990000", { template: "lembrete", params: ["Comprar\npão   e leite", "08:00"], text: "x" }, null);
    expect(bodies.at(-1)).toEqual({
      messaging_product: "whatsapp", to: "5511999990000", type: "template",
      template: { name: "lembrete_v1", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: "Comprar · pão e leite" }, { type: "text", text: "08:00" }] }] },
    });
  });

  it("sem o modelo configurado, falha com uma mensagem clara (a entrega fica marcada como falha)", async () => {
    const { whatsapp } = await import("./provider");
    await expect(whatsapp()!.sendProactive("5511999990000", { template: "resumo", params: ["x"], text: "x" }, null)).rejects.toThrow("META_TEMPLATE_RESUMO");
  });

  it("botões: no máximo 3, título de até 20 caracteres, sem o separador; Meta manda mensagem interativa", async () => {
    const { cleanButtons, whatsapp } = await import("./provider");
    expect(cleanButtons([
      { id: "u:1", title: "↩️ Desfazer" }, { id: "a|b\n:2", title: "Um título bem comprido demais para caber" }, { id: "x", title: "A | B" }, { id: "y", title: "quarto" }, { id: "", title: "sem id" },
    ])).toEqual([{ id: "u:1", title: "↩️ Desfazer" }, { id: "ab:2", title: "Um título bem compri" }, { id: "x", title: "A / B" }]);
    await whatsapp()!.sendButtons("5511999990000", "Foi no débito ou no crédito?", [{ id: "q:Débito", title: "Débito" }, { id: "q:Crédito", title: "Crédito" }]);
    expect(bodies.at(-1)).toEqual({
      messaging_product: "whatsapp", to: "5511999990000", type: "interactive",
      interactive: { type: "button", body: { text: "Foi no débito ou no crédito?" }, action: { buttons: [
        { type: "reply", reply: { id: "q:Débito", title: "Débito" } }, { type: "reply", reply: { id: "q:Crédito", title: "Crédito" } },
      ] } },
    });
    // dentro da janela de 24 h, o lembrete leva os botões; fora dela, só o modelo aprovado
    await whatsapp()!.sendProactive("5511999990000", { template: "lembrete", params: ["Remédio", "08:00"], text: "⏰ Remédio" }, new Date(Date.now() - 60_000), [{ id: "r:d:1", title: "✅ Feito" }]);
    expect(bodies.at(-1)).toMatchObject({ type: "interactive" });
    await whatsapp()!.sendProactive("5511999990000", { template: "lembrete", params: ["Remédio", "08:00"], text: "⏰ Remédio" }, null, [{ id: "r:d:1", title: "✅ Feito" }]);
    expect(bodies.at(-1)).toMatchObject({ type: "template" });
    // o toque no botão chega como mensagem interativa
    const parsed = whatsapp()!.parseWebhook({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "5511999990000", timestamp: "1760000000", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "r:d:1", title: "✅ Feito" } } }] } }] }] });
    expect(parsed).toEqual([expect.objectContaining({ button: { id: "r:d:1" }, text: "✅ Feito" })]);
  });
});

// ZapCoder: webhook assinado (HMAC), mesmo corpo de mensagem da UAZAPI, envio pelas rotas /send/*
describe("ZapCoder", () => {
  const SECRET = "segredo-do-webhook-com-mais-de-16-caracteres";
  const calls: Array<{ url: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> }> = [];
  let server: http.Server;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let d = ""; req.on("data", (c) => (d += c));
      req.on("end", () => {
        calls.push({ url: req.url!, headers: req.headers, body: d ? JSON.parse(d) : {} });
        res.setHeader("content-type", "application/json");
        if (req.url === "/message/download") return res.end(JSON.stringify({ fileURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/files/a.jpg`, mimetype: "image/jpeg" }));
        res.end(JSON.stringify({ messageid: "3EB0", status: "Sent" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      WHATSAPP_PROVIDER: "zapcoder", ZAPCODER_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      ZAPCODER_INSTANCE_TOKEN: "tok-zap", ZAPCODER_WEBHOOK_SECRET: SECRET,
    });
  });
  afterAll(() => { server.close(); for (const k of ["WHATSAPP_PROVIDER", "ZAPCODER_BASE_URL", "ZAPCODER_INSTANCE_TOKEN", "ZAPCODER_WEBHOOK_SECRET"]) delete process.env[k]; });

  const sign = (body: string, enc: "hex" | "base64" = "hex") => `sha256=${crypto.createHmac("sha256", SECRET).update(body).digest(enc)}`;
  const message = (extra: Record<string, unknown> = {}) => ({
    EventType: "messages", owner: "5511900000000", token: "tok-zap", instanceName: "x", chat: { wa_chatid: "5511999990000@s.whatsapp.net", wa_isGroup: false },
    message: { chatid: "5511999990000@s.whatsapp.net", sender: "5511999990000@s.whatsapp.net", fromMe: false, isGroup: false, wasSentByApi: false, messageType: "Conversation",
      text: " gastei 10 no café ", id: "5511900000000:3EB0AA", messageid: "3EB0AA", messageTimestamp: 1760000000000, ...extra },
  });

  it("confere a assinatura do corpo cru (hex ou base64) e recusa sem assinatura, com segredo errado ou corpo alterado", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    expect(wa.name).toBe("zapcoder");
    const raw = JSON.stringify(message());
    const verify = (headers: Record<string, string>, body = raw) => wa.verifyWebhook({ url: "https://app.exemplo.com/api/webhooks/whatsapp", headers: new Headers(headers), rawBody: body });
    expect(verify({ "x-zapcoder-signature": sign(raw) })).toBe(true);
    expect(verify({ "x-zapcoder-signature": sign(raw, "base64") })).toBe(true);
    expect(verify({})).toBe(false);
    expect(verify({ "x-zapcoder-signature": "sha256=abc" })).toBe(false);
    expect(verify({ "x-zapcoder-signature": sign(raw) }, raw.replace("café", "carro"))).toBe(false);
    expect(verify({ "x-zapcoder-signature": sign(raw).replace("sha256=", "") })).toBe(false);
    // nem o token da instância no corpo nem a URL bastam: sem assinatura, recusa
    expect(wa.verifyWebhook({ url: "https://app.exemplo.com/api/webhooks/whatsapp?secret=" + SECRET, headers: new Headers(), rawBody: raw })).toBe(false);
  });

  it("lê mensagem de pessoa; ignora grupo, as enviadas por nós ou pelo celular e outros eventos", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    expect(wa.parseWebhook(message())).toEqual([{ externalId: "3EB0AA", from: "5511999990000", text: "gastei 10 no café", button: null, audio: null, image: null, file: null, at: new Date(1760000000000) }]);
    expect(wa.parseWebhook(message({ isGroup: true }))).toEqual([]);
    expect(wa.parseWebhook(message({ fromMe: true }))).toEqual([]);
    expect(wa.parseWebhook(message({ wasSentByApi: true }))).toEqual([]);
    expect(wa.parseWebhook({ ...message(), EventType: "messages_update" })).toEqual([]);
    expect(wa.parseWebhook(message({ chatid: "123@g.us", sender: "123@g.us" }))).toEqual([]);
    // número real vem em sender_pn quando o chat usa LID
    expect(wa.parseWebhook(message({ chatid: "98765@lid", sender: "98765@lid", sender_pn: "5511988887777@s.whatsapp.net" }))[0]).toMatchObject({ from: "5511988887777" });
  });

  it("áudio, foto, PDF e toque em botão chegam com o id do WhatsApp (sem o prefixo do aparelho) para baixar", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    expect(wa.parseWebhook(message({ messageType: "AudioMessage", text: "" }))[0]).toMatchObject({ audio: { ref: "3EB0AA" }, text: null });
    expect(wa.parseWebhook(message({ messageType: "ImageMessage", text: "nota" }))[0]).toMatchObject({ image: { ref: "3EB0AA", caption: "nota" }, text: null });
    expect(wa.parseWebhook(message({ messageType: "DocumentMessage", text: "", content: { mimetype: "application/pdf", fileName: "nota.pdf" } }))[0])
      .toMatchObject({ file: { ref: "3EB0AA", mimeType: "application/pdf", fileName: "nota.pdf" } });
    expect(wa.parseWebhook(message({ messageType: "TemplateButtonReplyMessage", text: "✅ Feito", buttonOrListid: "r:d:1" }))[0]).toMatchObject({ button: { id: "r:d:1" } });
  });

  it("envia texto, botões e arquivo pelas rotas /send/* com o token no cabeçalho, número só em dígitos", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    await wa.sendText("+55 (11) 99999-0000", "oi");
    expect(calls.at(-1)).toMatchObject({ url: "/send/text", headers: { token: "tok-zap" }, body: { number: "5511999990000", text: "oi", linkPreview: false } });
    await wa.sendButtons("5511999990000", "Foi no débito?", [{ id: "q:Débito", title: "Débito" }, { id: "q:Crédito", title: "Crédito" }]);
    expect(calls.at(-1)).toMatchObject({ url: "/send/menu", body: { type: "button", choices: ["Débito|q:Débito", "Crédito|q:Crédito"] } });
    await wa.sendFile("5511999990000", { bytes: Buffer.from("pdf"), mimeType: "application/pdf", fileName: "nota.pdf", caption: "sua nota" });
    expect(calls.at(-1)).toMatchObject({ url: "/send/media", body: { type: "document", docName: "nota.pdf", text: "sua nota", file: Buffer.from("pdf").toString("base64") } });
    // lembrete com botões vai como mensagem de botões; sem botões, texto (não há janela nem modelo)
    await wa.sendProactive("5511999990000", { template: "lembrete", params: ["x"], text: "⏰ x" }, null, [{ id: "r:d:1", title: "✅ Feito" }]);
    expect(calls.at(-1)).toMatchObject({ url: "/send/menu" });
    await wa.sendProactive("5511999990000", { template: "lembrete", params: ["x"], text: "⏰ x" }, null);
    expect(calls.at(-1)).toMatchObject({ url: "/send/text", body: { text: "⏰ x" } });
  });

  it("baixa a mídia pelo id e devolve os bytes", async () => {
    const { whatsapp } = await import("./provider");
    const wa = whatsapp()!;
    const got = await wa.downloadAudio("3EB0AA");
    expect(calls.filter((c) => c.url === "/message/download").at(-1)!.body).toEqual({ id: "3EB0AA", generate_mp3: true });
    expect(got.mimeType).toBe("image/jpeg");
    expect(got.data.byteLength).toBeGreaterThan(0);
  });
});
