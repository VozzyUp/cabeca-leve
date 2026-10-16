// Confere a UAZAPI de fora: a instância está conectada e para onde ela manda as mensagens (o webhook cadastrado)?
// Só leitura. Quando "nada responde" no WhatsApp, quase sempre é um destes: instância desconectada, ou webhook apontando
// para um endereço antigo (domínio trocado) ou com o segredo errado.

export type WhatsAppCheck = {
  site: string;
  provider: string;
  botNumber: string | null;
  expectedWebhook: string;
  queue: { token: boolean; signingKeys: boolean };
  uazapi: null | {
    reachable: boolean; error?: string;
    connected: boolean | null; state: string | null; number: string | null;
    webhooks: Array<{ url: string; enabled: boolean | null; pointsHere: boolean; secretOk: boolean }>;
  };
};

type Env = Record<string, string | undefined>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function webhookMatches(registered: string, site: string, secret: string | undefined) {
  try {
    const u = new URL(registered), s = new URL(site);
    return { pointsHere: u.origin === s.origin && u.pathname.replace(/\/$/, "") === "/api/webhooks/whatsapp", secretOk: !!secret && u.searchParams.get("secret") === secret };
  } catch { return { pointsHere: false, secretOk: false }; }
}

async function getJson(fetcher: typeof fetch, url: string, token: string) {
  const res = await fetcher(url, { headers: { token, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json() as Promise<unknown>;
}

export async function checkWhatsApp(env: Env, site: string, fetcher: typeof fetch = fetch): Promise<WhatsAppCheck> {
  const provider = env.WHATSAPP_PROVIDER === "meta" ? "meta" : "uazapi";
  const out: WhatsAppCheck = {
    site, provider, botNumber: env.WHATSAPP_BOT_NUMBER ?? null, expectedWebhook: `${site}/api/webhooks/whatsapp`,
    queue: { token: !!env.QSTASH_TOKEN, signingKeys: !!(env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) }, uazapi: null,
  };
  if (provider !== "uazapi") return out;
  const base = (env.UAZAPI_BASE_URL ?? "").replace(/\/$/, ""), token = env.UAZAPI_INSTANCE_TOKEN ?? "";
  if (!base || !token) return { ...out, uazapi: { reachable: false, error: "Faltam o endereço do servidor ou o token da instância da UAZAPI.", connected: null, state: null, number: null, webhooks: [] } };
  const result: NonNullable<WhatsAppCheck["uazapi"]> = { reachable: true, connected: null, state: null, number: null, webhooks: [] };
  try {
    const status = (await getJson(fetcher, `${base}/instance/status`, token)) as { instance?: Record<string, unknown>; status?: Record<string, unknown> };
    const state = str(status.instance?.status);
    result.state = state;
    result.connected = typeof status.status?.connected === "boolean" ? status.status.connected : state ? state === "connected" : null;
    result.number = str(status.instance?.owner) ?? str((status.status?.jid as { user?: unknown } | undefined)?.user);
  } catch (error) {
    return { ...out, uazapi: { ...result, reachable: false, error: `Não consegui falar com a UAZAPI (${(error as Error).message}).` } };
  }
  try {
    const hooks = (await getJson(fetcher, `${base}/webhook`, token)) as unknown;
    const list = Array.isArray(hooks) ? hooks : hooks && typeof hooks === "object" ? [hooks] : [];
    result.webhooks = list.flatMap((h) => {
      const url = str((h as { url?: unknown }).url);
      return url ? [{ url, enabled: typeof (h as { enabled?: unknown }).enabled === "boolean" ? (h as { enabled: boolean }).enabled : null, ...webhookMatches(url, site, env.UAZAPI_WEBHOOK_SECRET) }] : [];
    });
  } catch (error) {
    result.error = `A instância responde, mas não consegui ler o webhook (${(error as Error).message}).`;
  }
  return { ...out, uazapi: result };
}
