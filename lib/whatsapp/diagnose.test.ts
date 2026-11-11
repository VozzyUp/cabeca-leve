import { describe, expect, it } from "vitest";
import { checkWhatsApp, setupZapcoderWebhook, webhookMatches, zapcoderWebhookMatches } from "./diagnose";

const SITE = "https://perai.exemplo.com.br";
const env = { WHATSAPP_PROVIDER: "uazapi", UAZAPI_BASE_URL: "https://uaz.exemplo.com/", UAZAPI_INSTANCE_TOKEN: "tok", UAZAPI_WEBHOOK_SECRET: "segredo", WHATSAPP_BOT_NUMBER: "5511999990000", QSTASH_TOKEN: "q" };

const reply = (routes: Record<string, unknown>): typeof fetch => (async (url: string) => {
  const key = new URL(url).pathname;
  if (!(key in routes)) return new Response("nope", { status: 404 });
  return Response.json(routes[key]);
}) as never;

const zapEnv = { WHATSAPP_PROVIDER: "zapcoder", ZAPCODER_BASE_URL: "https://zap.exemplo.com/", ZAPCODER_INSTANCE_TOKEN: "tok", ZAPCODER_WEBHOOK_SECRET: "segredo-com-mais-de-16-caracteres", WHATSAPP_BOT_NUMBER: "5511999990000", QSTASH_TOKEN: "q" };

describe("diagnóstico do WhatsApp (ZapCoder)", () => {
  it("webhook com a URL do app e segredo cadastrado: tudo certo; sem segredo ou em domínio antigo, não", () => {
    expect(zapcoderWebhookMatches(`${SITE}/api/webhooks/whatsapp`, SITE, true, true)).toEqual({ pointsHere: true, secretOk: true });
    expect(zapcoderWebhookMatches(`${SITE}/api/webhooks/whatsapp`, SITE, false, true)).toEqual({ pointsHere: true, secretOk: false });
    expect(zapcoderWebhookMatches("https://cabeca.exemplo.com.br/api/webhooks/whatsapp", SITE, true, true)).toEqual({ pointsHere: false, secretOk: true });
    expect(zapcoderWebhookMatches(`${SITE}/api/webhooks/whatsapp`, SITE, true, false).secretOk).toBe(false);
  });

  it("lê a instância e o webhook da ZapCoder e diz o nome do gateway", async () => {
    const r = await checkWhatsApp(zapEnv, SITE, reply({
      "/instance/status": { instance: { status: "connected", owner: "5511999990000" }, status: { connected: true, loggedIn: true, jid: { user: "5511999990000" } } },
      "/webhook": [{ id: "w1", url: `${SITE}/api/webhooks/whatsapp`, enabled: true, hasSecret: true, events: ["messages"] }],
    }));
    expect(r.gatewayName).toBe("ZapCoder");
    expect(r.gateway).toMatchObject({ reachable: true, connected: true, number: "5511999990000", webhooks: [{ pointsHere: true, secretOk: true, enabled: true }] });
  });

  it("sem WHATSAPP_PROVIDER, o que estiver configurado vale: ZapCoder, ou a UAZAPI que já rodava", async () => {
    const { providerName } = await import("./provider");
    expect(providerName({})).toBe("zapcoder");
    expect(providerName({ UAZAPI_INSTANCE_TOKEN: "x" })).toBe("uazapi");
    expect(providerName({ UAZAPI_INSTANCE_TOKEN: "x", ZAPCODER_INSTANCE_TOKEN: "y" })).toBe("zapcoder");
    expect(providerName({ WHATSAPP_PROVIDER: "meta", ZAPCODER_INSTANCE_TOKEN: "y" })).toBe("meta");
  });

  it("cadastra o webhook pelo sistema: URL limpa, só mensagens recebidas e o segredo; recusa sem segredo", async () => {
    const sent: Array<{ url: string; method?: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    const fake = (async (url: string, init: RequestInit) => { sent.push({ url, method: init.method, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) }); return Response.json({ ok: true }); }) as never;
    expect(await setupZapcoderWebhook(zapEnv, SITE, fake)).toEqual({ ok: true });
    expect(sent[0]).toMatchObject({ url: "https://zap.exemplo.com/webhook", method: "POST", headers: { token: "tok" } });
    expect(sent[0].body).toEqual({ url: `${SITE}/api/webhooks/whatsapp`, events: ["messages"], excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"], addUrlEvents: false, addUrlTypesMessages: false, secret: zapEnv.ZAPCODER_WEBHOOK_SECRET });
    expect(await setupZapcoderWebhook({ ...zapEnv, ZAPCODER_WEBHOOK_SECRET: "" }, SITE, fake)).toMatchObject({ ok: false, error: expect.stringMatching(/Gere o segredo/) });
    expect(await setupZapcoderWebhook(zapEnv, SITE, (async () => new Response("erro", { status: 400 })) as never)).toMatchObject({ ok: false, error: expect.stringMatching(/recusou/) });
  });
});

describe("diagnóstico do WhatsApp", () => {
  it("reconhece o webhook certo, o de domínio antigo e o de segredo errado", () => {
    expect(webhookMatches(`${SITE}/api/webhooks/whatsapp?secret=segredo`, SITE, "segredo")).toEqual({ pointsHere: true, secretOk: true });
    expect(webhookMatches("https://cabeca.exemplo.com.br/api/webhooks/whatsapp?secret=segredo", SITE, "segredo")).toEqual({ pointsHere: false, secretOk: true });
    expect(webhookMatches(`${SITE}/api/webhooks/whatsapp?secret=outro`, SITE, "segredo")).toEqual({ pointsHere: true, secretOk: false });
    expect(webhookMatches("lixo", SITE, "segredo")).toEqual({ pointsHere: false, secretOk: false });
  });

  it("instância conectada com o webhook no endereço atual: tudo certo", async () => {
    const r = await checkWhatsApp(env, SITE, reply({
      "/instance/status": { instance: { status: "connected", owner: "5511999990000" }, status: { connected: true, loggedIn: true } },
      "/webhook": [{ url: `${SITE}/api/webhooks/whatsapp?secret=segredo`, enabled: true }],
    }));
    expect(r.gateway).toMatchObject({ reachable: true, connected: true, number: "5511999990000", webhooks: [{ pointsHere: true, secretOk: true, enabled: true }] });
    expect(r.queue).toEqual({ token: true, signingKeys: false });
    expect(r.expectedWebhook).toBe(`${SITE}/api/webhooks/whatsapp`);
  });

  it("webhook ainda no domínio antigo e instância desconectada aparecem como problema", async () => {
    const r = await checkWhatsApp(env, SITE, reply({
      "/instance/status": { instance: { status: "disconnected" }, status: { connected: false } },
      "/webhook": [{ url: "https://cabeca.exemplo.com.br/api/webhooks/whatsapp?secret=segredo" }],
    }));
    expect(r.gateway).toMatchObject({ connected: false, state: "disconnected" });
    expect(r.gateway!.webhooks[0]).toMatchObject({ pointsHere: false, secretOk: true });
  });

  it("UAZAPI fora do ar, sem credencial ou sem leitura do webhook: diz o que faltou, sem quebrar", async () => {
    const down = await checkWhatsApp(env, SITE, reply({}));
    expect(down.gateway).toMatchObject({ reachable: false, error: expect.stringMatching(/Não consegui falar/) });
    const none = await checkWhatsApp({ ...env, UAZAPI_INSTANCE_TOKEN: "" }, SITE, reply({}));
    expect(none.gateway).toMatchObject({ reachable: false, error: expect.stringMatching(/Faltam/) });
    const noHook = await checkWhatsApp(env, SITE, reply({ "/instance/status": { instance: { status: "connected" } } }));
    expect(noHook.gateway).toMatchObject({ reachable: true, connected: true, error: expect.stringMatching(/não consegui ler o webhook/) });
    expect((await checkWhatsApp({ ...env, WHATSAPP_PROVIDER: "meta" }, SITE, reply({}))).gateway).toBeNull();
  });
});
