import { getAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Último sinal de cada serviço (system_status), para o time ver em Administração o que aconteceu quando algo "não responde".
// Gravar nunca derruba quem chama: é só registro.
export type StatusKey = "whatsapp_webhook" | "whatsapp_job" | "whatsapp_inbound";
export type Signal = { result: string; ok: boolean; detail?: string; at: string };

export async function recordStatus(key: StatusKey, result: string, ok: boolean, detail?: string) {
  if (!isSupabaseConfigured()) return;
  try {
    const value: Signal = { result, ok, at: new Date().toISOString(), ...(detail ? { detail: detail.slice(0, 300) } : {}) };
    await getAdmin().from("system_status").upsert({ key, value: value as never, updated_at: value.at });
  } catch (error) {
    console.error("diagnóstico não gravado", key, (error as Error).message);
  }
}

export async function readStatus(): Promise<Partial<Record<StatusKey, Signal>>> {
  const { data } = await getAdmin().from("system_status").select("key, value");
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Partial<Record<StatusKey, Signal>>;
}
