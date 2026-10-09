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
