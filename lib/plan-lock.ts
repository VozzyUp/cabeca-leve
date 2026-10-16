import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseEnv } from "@/lib/supabase/env";
import { isSupportAdmin } from "@/lib/admin-emails";
import { localDate } from "@/lib/time";

// Bloqueio de quem não tem acesso: o teste grátis acabou e não há assinatura (nem pagamento em confirmação).
// Vale para todas as telas e rotas do app, menos a conta e a cobrança, para a pessoa poder assinar, pedir ajuda
// e levar ou apagar os próprios dados. O time (ADMIN_EMAILS) nunca é bloqueado.
// A regra é a mesma do getSettings: assinatura que vale, ou teste dentro do prazo, ou volta do pagamento nas últimas 2 h.

export const EXPIRED_HREF = "/ajustes/plano?expirou=1";

// Telas e rotas que seguem abertas para quem está sem plano (as públicas — início, planos, entrar, termos — já são abertas)
const OPEN_WHEN_LOCKED = [/^\/ajustes\/?$/, /^\/ajustes\/plano\/?$/, /^\/ajustes\/suporte\/?$/, /^\/assinar\//, /^\/api\/billing\//];
export const openWhenLocked = (path: string) => OPEN_WHEN_LOCKED.some((r) => r.test(path));

export class PlanExpiredError extends Error {
  constructor() { super("Seu teste terminou. Escolha um plano para continuar."); }
}

type Db = SupabaseClient<Database>;

// Cliente de serviço sem depender de cookies (o proxy não tem acesso a next/headers)
let direct: Db | null = null;
export function lockClient(): Db | null {
  const env = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;
  direct ??= createClient<Database>(env.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return direct;
}

// Só "liberado" fica guardado (30 s): quem acabou de pagar entra na hora, e quem acabou de vencer espera meio minuto no máximo
const unlocked = new Map<string, number>();
const TTL_MS = 30_000;

export function forgetLock(userId?: string) {
  if (userId) unlocked.delete(userId);
  else unlocked.clear();
}

// true = sem acesso. Em dúvida (erro de banco, perfil ausente) deixa passar: ninguém fica de fora por um tropeço.
export async function isLocked(db: Db, userId: string, email: string | null | undefined, now = new Date()): Promise<boolean> {
  if (isSupportAdmin(email)) return false;
  if ((unlocked.get(userId) ?? 0) > now.getTime()) return false;
  const free = () => { unlocked.set(userId, now.getTime() + TTL_MS); return false; };
  try {
    const { data: profile, error } = await db.from("profiles").select("trial_ends_on, timezone").eq("user_id", userId).maybeSingle();
    if (error || !profile) return false;
    if (profile.trial_ends_on >= localDate(now, profile.timezone)) return free();
    const nowIso = now.toISOString();
    const { data: subs, error: subError } = await db.from("subscriptions").select("status, current_period_end").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    if (subError) return false;
    if ((subs ?? []).some((s) => ["active", "trialing", "past_due"].includes(s.status) || (s.current_period_end ?? "") > nowIso)) return free();
    const { data: checkout, error: checkoutError } = await db.from("checkout_sessions").select("id").eq("user_id", userId).eq("status", "pending")
      .gte("returned_at", new Date(now.getTime() - 2 * 3_600_000).toISOString()).limit(1);
    if (checkoutError) return false;
    return checkout?.length ? free() : true;
  } catch (error) {
    console.error("não deu para conferir o plano", (error as Error).message);
    return false;
  }
}
