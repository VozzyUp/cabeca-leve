import crypto from "node:crypto";
import { getAdmin } from "@/lib/supabase/server";

// Configuração do sistema guardada no banco (tela /admin/configuracoes), criptografada com
// APP_SECRET_KEY. Ao ler, os valores entram em process.env: todo o resto do app continua lendo
// process.env.X sem saber de onde veio. O que está no banco vale mais que a variável do stack.

export type ConfigField = { key: string; label: string; secret: boolean; hint?: string; options?: string[]; generate?: "vapid" | "hex32" };
export type ConfigGroup = { title: string; fields: ConfigField[] };

export const CONFIG_GROUPS: ConfigGroup[] = [
  { title: "Assistente (Anthropic)", fields: [{ key: "ANTHROPIC_API_KEY", label: "Chave da API", secret: true, hint: "console.anthropic.com > API Keys" }] },
  { title: "Áudio (Groq)", fields: [{ key: "GROQ_API_KEY", label: "Chave da API", secret: true, hint: "console.groq.com > API Keys" }] },
  { title: "WhatsApp", fields: [
    { key: "WHATSAPP_PROVIDER", label: "Provedor", secret: false, options: ["uazapi", "meta"] },
    { key: "WHATSAPP_BOT_NUMBER", label: "Número do assistente (com DDI)", secret: false, hint: "ex.: 5511999990000" },
    { key: "UAZAPI_BASE_URL", label: "UAZAPI: endereço do servidor", secret: false, hint: "ex.: https://suaempresa.uazapi.com" },
    { key: "UAZAPI_INSTANCE_TOKEN", label: "UAZAPI: token da instância", secret: true },
    { key: "UAZAPI_WEBHOOK_SECRET", label: "UAZAPI: segredo do webhook", secret: true, generate: "hex32", hint: "vai no fim da URL do webhook: ?secret=…" },
    { key: "META_WHATSAPP_TOKEN", label: "Meta: token de acesso", secret: true },
    { key: "META_WHATSAPP_PHONE_NUMBER_ID", label: "Meta: ID do número", secret: false },
    { key: "META_APP_SECRET", label: "Meta: app secret", secret: true },
    { key: "META_WEBHOOK_VERIFY_TOKEN", label: "Meta: token de verificação do webhook", secret: true, generate: "hex32" },
    { key: "META_TEMPLATE_LEMBRETE", label: "Meta: modelo de lembrete", secret: false },
    { key: "META_TEMPLATE_RESUMO", label: "Meta: modelo de resumo", secret: false },
    { key: "META_TEMPLATE_AVISO", label: "Meta: modelo de aviso", secret: false },
  ] },
  { title: "Cobrança (Asaas)", fields: [
    { key: "ASAAS_API_URL", label: "Ambiente", secret: false, options: ["https://api-sandbox.asaas.com/v3", "https://api.asaas.com/v3"] },
    { key: "ASAAS_API_KEY", label: "Chave da API", secret: true },
    { key: "ASAAS_WEBHOOK_TOKEN", label: "Token do webhook (32+ caracteres)", secret: true, generate: "hex32" },
  ] },
  { title: "E-mail (Resend)", fields: [
    { key: "RESEND_API_KEY", label: "Chave da API", secret: true },
    { key: "EMAIL_FROM", label: "Remetente", secret: false, hint: "ex.: Cabeça Leve <ola@seudominio.com.br>" },
  ] },
  { title: "Notificações no aparelho (push)", fields: [
    { key: "VAPID_PUBLIC_KEY", label: "Chave pública", secret: false, generate: "vapid" },
    { key: "VAPID_PRIVATE_KEY", label: "Chave privada", secret: true },
    { key: "VAPID_SUBJECT", label: "Contato", secret: false, hint: "mailto:contato@seudominio.com.br" },
  ] },
  { title: "Suporte", fields: [
    { key: "SUPPORT_EMAIL", label: "E-mail que recebe os chamados", secret: false },
    { key: "SUPPORT_WHATSAPP", label: "WhatsApp que recebe os chamados (com DDI)", secret: false },
  ] },
];

export const CONFIG_KEYS = new Set(CONFIG_GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

// ---- criptografia (AES-256-GCM; a chave vem de APP_SECRET_KEY, qualquer texto longo) ----
function cipherKey() {
  const raw = process.env.APP_SECRET_KEY ?? "";
  if (raw.length < 32) throw new Error("APP_SECRET_KEY ausente ou curta (mínimo 32 caracteres)");
  return crypto.createHash("sha256").update(raw).digest();
}
export function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}
export function decrypt(payload: string) {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1") throw new Error("formato desconhecido");
  const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

// ---- leitura: banco por cima das variáveis do stack ----
// Estado global (o Next pode carregar este módulo mais de uma vez): o valor original do stack,
// guardado antes de qualquer valor do banco entrar, para voltar a ele se apagarem na tela.
type State = { fromEnv: Map<string, string | undefined>; loadedAt: number; loading: Promise<void> | null };
const g = globalThis as typeof globalThis & { __appConfig?: State };
const state: State = (g.__appConfig ??= { fromEnv: new Map([...CONFIG_KEYS].map((k) => [k, process.env[k]])), loadedAt: 0, loading: null });

export async function loadAppConfig(force = false) {
  if (!process.env.APP_SECRET_KEY || !process.env.SUPABASE_SECRET_KEY && !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;
  if (!force && Date.now() - state.loadedAt < 30_000) return;
  state.loading ??= (async () => {
    try {
      const { data, error } = await getAdmin().from("app_settings").select("key, value_encrypted");
      if (error) throw new Error(error.message);
      const inDb = new Map((data ?? []).filter((r) => CONFIG_KEYS.has(r.key)).map((r) => [r.key, r.value_encrypted]));
      for (const key of CONFIG_KEYS) {
        const enc = inDb.get(key);
        let value = state.fromEnv.get(key);
        if (enc) { try { value = decrypt(enc); } catch { console.error("config: não deu para abrir", key); } }
        if (value === undefined || value === "") delete process.env[key]; else process.env[key] = value;
      }
      state.loadedAt = Date.now();
    } catch (e) {
      console.error("config: leitura falhou", (e as Error).message);
    } finally {
      state.loading = null;
    }
  })();
  await state.loading;
}

export type FieldStatus = { key: string; source: "banco" | "stack" | "faltando"; preview: string | null };

export async function configStatus(): Promise<FieldStatus[]> {
  const { data } = await getAdmin().from("app_settings").select("key");
  const inDb = new Set((data ?? []).map((r) => r.key));
  const secretKeys = new Set(CONFIG_GROUPS.flatMap((g) => g.fields.filter((f) => f.secret).map((f) => f.key)));
  return [...CONFIG_KEYS].map((key) => {
    const value = process.env[key];
    const source = inDb.has(key) ? "banco" : state.fromEnv.get(key) ? "stack" : "faltando";
    // segredo nunca volta inteiro para a tela: só os 4 últimos caracteres
    const preview = !value ? null : secretKeys.has(key) ? `••••${value.slice(-4)}` : value;
    return { key, source, preview };
  });
}

export async function saveAppConfig(changes: Record<string, string | null>, by: string) {
  const db = getAdmin();
  for (const [key, value] of Object.entries(changes)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`chave desconhecida: ${key}`);
    if (value === null) {
      const { error } = await db.from("app_settings").delete().eq("key", key);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("app_settings").upsert({ key, value_encrypted: encrypt(value.trim()), updated_by: by, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
  }
  await loadAppConfig(true);
}
