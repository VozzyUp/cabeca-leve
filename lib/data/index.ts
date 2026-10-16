import { isLocked, PlanExpiredError } from "@/lib/plan-lock";
import { currentUser, getAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fakeStore } from "./fake-store";
import type { DataStore } from "./store";
import { createSupabaseStore } from "./supabase-store";

export { PlanExpiredError };

export class UnauthorizedError extends Error {
  constructor() { super("Sessão expirada. Entre de novo."); }
}

// Banco do usuário da sessão atual. Sem Supabase configurado, o modo de demonstração.
// Sem plano (o teste acabou e não há assinatura) nada abre, a não ser que quem chama seja a conta e a cobrança (allowLocked).
export async function getStore(opts: { allowLocked?: boolean } = {}): Promise<DataStore> {
  if (!isSupabaseConfigured()) return fakeStore;
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  if (!opts.allowLocked && (await isLocked(getAdmin(), user.id, user.email))) throw new PlanExpiredError();
  return createSupabaseStore(getAdmin(), user.id, user.email ?? null);
}

// Banco de um usuário conhecido, sem sessão (webhooks e filas, que já autenticaram a origem)
export async function storeForUser(userId: string): Promise<DataStore> {
  if (!isSupabaseConfigured()) return fakeStore;
  const { data } = await getAdmin().auth.admin.getUserById(userId);
  return createSupabaseStore(getAdmin(), userId, data.user?.email ?? null);
}
