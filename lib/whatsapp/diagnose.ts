import { providerName, ZAPCODER_DEFAULT_URL } from "./provider";

// Confere o gateway do WhatsApp (ZapCoder ou UAZAPI) de fora: a instância está conectada e para onde ela manda as mensagens
// (o webhook cadastrado)? Só leitura. Quando "nada responde" no WhatsApp, quase sempre é um destes: instância desconectada,
// webhook apontando para um endereço antigo (domínio trocado) ou sem o segredo certo.

export type WhatsAppCheck = {
  site: string;
  provider: string;
  gatewayName: "ZapCoder" | "UAZAPI" | null;
  botNumber: string | null;
  expectedWebhook: string;
  queue: { token: boolean; signingKeys: boolean };
  gateway: null | {
    reachable: boolean; error?: string;
    connected: boolean | null; state: string | null; number: string | null;
    webhooks: Array<{ url: string; enabled: boolean | null; pointsHere: boolean; secretOk: boolean }>;
  };
};

type Env = Record<string, string | undefined>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const WEBHOOK_PATH = "/api/webhooks/whatsapp";

// UAZAPI: o segredo vai na URL
export function webhookMatches(registered: string, site: string, secret: string | undefined) {
  try {
    const u = new URL(registered), s = new URL(site);
    return { pointsHere: u.origin === s.origin && u.pathname.replace(/\/$/, "") === WEBHOOK_PATH, secretOk: !!secret && u.searchParams.get("secret") === secret };
  } catch { return { pointsHere: false, secretOk: false }; }
}

// ZapCoder: a URL é limpa e o segredo assina cada entrega; a API só diz se o webhook TEM segredo (hasSecret), nunca qual
export function zapcoderWebhookMatches(registered: string, site: string, hasSecret: boolean | null, secretConfigured: boolean) {
  try {
    const u = new URL(registered), s = new URL(site);
    return { pointsHere: u.origin === s.origin && u.pathname.replace(/\/$/, "") === WEBHOOK_PATH, secretOk: secretConfigured && hasSecret === true };
  } catch { return { pointsHere: false, secretOk: false }; }
}

async function getJson(fetcher: typeof fetch, url: string, token: string) {
  const res = await fetcher(url, { headers: { token, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json() as Promise<unknown>;
}

const zapcoderBase = (env: Env) => (env.ZAPCODER_BASE_URL || ZAPCODER_DEFAULT_URL).replace(/\/$/, "");

export async function checkWhatsApp(env: Env, site: string, fetcher: typeof fetch = fetch): Promise<WhatsAppCheck> {
  const provider = providerName(env);
  const zap = provider === "zapcoder";
  const gatewayName = provider === "meta" ? null : zap ? "ZapCoder" : "UAZAPI";
  const out: WhatsAppCheck = {
    site, provider, gatewayName, botNumber: env.WHATSAPP_BOT_NUMBER ?? null, expectedWebhook: `${site}${WEBHOOK_PATH}`,
    queue: { token: !!env.QSTASH_TOKEN, signingKeys: !!(env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) }, gateway: null,
  };
  if (!gatewayName) return out;
  const base = zap ? zapcoderBase(env) : (env.UAZAPI_BASE_URL ?? "").replace(/\/$/, "");
  const token = (zap ? env.ZAPCODER_INSTANCE_TOKEN : env.UAZAPI_INSTANCE_TOKEN) ?? "";
  const secret = zap ? env.ZAPCODER_WEBHOOK_SECRET : env.UAZAPI_WEBHOOK_SECRET;
  if (!base || !token) {
    return { ...out, gateway: { reachable: false, error: `Faltam o endereço do servidor ou o token da instância da ${gatewayName}.`, connected: null, state: null, number: null, webhooks: [] } };
  }
  const result: NonNullable<WhatsAppCheck["gateway"]> = { reachable: true, connected: null, state: null, number: null, webhooks: [] };
  try {
    const status = (await getJson(fetcher, `${base}/instance/status`, token)) as { instance?: Record<string, unknown>; status?: Record<string, unknown> };
    const state = str(status.instance?.status);
    result.state = state;
    result.connected = typeof status.status?.connected === "boolean" ? status.status.connected : state ? state === "connected" : null;
    result.number = str(status.instance?.owner) ?? str((status.status?.jid as { user?: unknown } | undefined)?.user);
  } catch (error) {
    return { ...out, gateway: { ...result, reachable: false, error: `Não consegui falar com a ${gatewayName} (${(error as Error).message}).` } };
  }
  try {
    const hooks = (await getJson(fetcher, `${base}/webhook`, token)) as unknown;
    const list = Array.isArray(hooks) ? hooks : hooks && typeof hooks === "object" ? [hooks] : [];
    result.webhooks = list.flatMap((h) => {
      const url = str((h as { url?: unknown }).url);
      if (!url) return [];
      const enabled = typeof (h as { enabled?: unknown }).enabled === "boolean" ? (h as { enabled: boolean }).enabled : null;
      const hasSecret = typeof (h as { hasSecret?: unknown }).hasSecret === "boolean" ? (h as { hasSecret: boolean }).hasSecret : null;
      return [{ url, enabled, ...(zap ? zapcoderWebhookMatches(url, site, hasSecret, !!secret) : webhookMatches(url, site, secret)) }];
    });
  } catch (error) {
    result.error = `A instância responde, mas não consegui ler o webhook (${(error as Error).message}).`;
  }
  return { ...out, gateway: result };
}

// Cadastra o webhook na ZapCoder pelo próprio sistema (o que mais travou o WhatsApp foi endereço ou segredo digitado errado):
// só mensagens recebidas, sem as enviadas pela API, as enviadas pelo celular e as de grupo, assinadas com o segredo do sistema.
export async function setupZapcoderWebhook(env: Env, site: string, fetcher: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = env.ZAPCODER_INSTANCE_TOKEN ?? "", secret = env.ZAPCODER_WEBHOOK_SECRET ?? "";
  if (providerName(env) !== "zapcoder") return { ok: false, error: "O provedor escolhido não é a ZapCoder." };
  if (!token) return { ok: false, error: "Falta o token da instância da ZapCoder." };
  if (secret.length < 16) return { ok: false, error: "Gere o segredo do webhook da ZapCoder (campo abaixo) antes de cadastrar." };
  try {
    const res = await fetcher(`${zapcoderBase(env)}/webhook`, {
      method: "POST", headers: { "Content-Type": "application/json", token }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ url: `${site}${WEBHOOK_PATH}`, events: ["messages"], excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"], addUrlEvents: false, addUrlTypesMessages: false, secret }),
    });
    if (!res.ok) return { ok: false, error: `A ZapCoder recusou o cadastro (${res.status} ${(await res.text()).slice(0, 120)}).` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Não consegui falar com a ZapCoder (${(error as Error).message}).` };
  }
}
