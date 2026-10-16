import { describe, expect, it } from "vitest";
import { checkWhatsApp, webhookMatches } from "./diagnose";

const SITE = "https://perai.exemplo.com.br";
const env = { WHATSAPP_PROVIDER: "uazapi", UAZAPI_BASE_URL: "https://uaz.exemplo.com/", UAZAPI_INSTANCE_TOKEN: "tok", UAZAPI_WEBHOOK_SECRET: "segredo", WHATSAPP_BOT_NUMBER: "5511999990000", QSTASH_TOKEN: "q" };

const reply = (routes: Record<string, unknown>): typeof fetch => (async (url: string) => {
  const key = new URL(url).pathname;
  if (!(key in routes)) return new Response("nope", { status: 404 });
  return Response.json(routes[key]);
}) as never;

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
    expect(r.uazapi).toMatchObject({ reachable: true, connected: true, number: "5511999990000", webhooks: [{ pointsHere: true, secretOk: true, enabled: true }] });
    expect(r.queue).toEqual({ token: true, signingKeys: false });
    expect(r.expectedWebhook).toBe(`${SITE}/api/webhooks/whatsapp`);
  });

  it("webhook ainda no domínio antigo e instância desconectada aparecem como problema", async () => {
    const r = await checkWhatsApp(env, SITE, reply({
      "/instance/status": { instance: { status: "disconnected" }, status: { connected: false } },
      "/webhook": [{ url: "https://cabeca.exemplo.com.br/api/webhooks/whatsapp?secret=segredo" }],
    }));
    expect(r.uazapi).toMatchObject({ connected: false, state: "disconnected" });
    expect(r.uazapi!.webhooks[0]).toMatchObject({ pointsHere: false, secretOk: true });
  });

  it("UAZAPI fora do ar, sem credencial ou sem leitura do webhook: diz o que faltou, sem quebrar", async () => {
    const down = await checkWhatsApp(env, SITE, reply({}));
    expect(down.uazapi).toMatchObject({ reachable: false, error: expect.stringMatching(/Não consegui falar/) });
    const none = await checkWhatsApp({ ...env, UAZAPI_INSTANCE_TOKEN: "" }, SITE, reply({}));
    expect(none.uazapi).toMatchObject({ reachable: false, error: expect.stringMatching(/Faltam/) });
    const noHook = await checkWhatsApp(env, SITE, reply({ "/instance/status": { instance: { status: "connected" } } }));
    expect(noHook.uazapi).toMatchObject({ reachable: true, connected: true, error: expect.stringMatching(/não consegui ler o webhook/) });
    expect((await checkWhatsApp({ ...env, WHATSAPP_PROVIDER: "meta" }, SITE, reply({}))).uazapi).toBeNull();
  });
});
