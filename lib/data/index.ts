import { currentUser, getAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fakeStore } from "./fake-store";
import type { DataStore } from "./store";
import { createSupabaseStore } from "./supabase-store";

export class UnauthorizedError extends Error {
  constructor() { super("Sessão expirada. Entre de novo."); }
}

// Banco do usuário da sessão atual. Sem Supabase configurado, o modo de demonstração.
export async function getStore(): Promise<DataStore> {
  if (!isSupabaseConfigured()) return fakeStore;
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return createSupabaseStore(getAdmin(), user.id, user.email ?? null);
}

// Banco de um usuário conhecido, sem sessão (webhooks e filas, que já autenticaram a origem)
export async function storeForUser(userId: string): Promise<DataStore> {
  if (!isSupabaseConfigured()) return fakeStore;
  const { data } = await getAdmin().auth.admin.getUserById(userId);
  return createSupabaseStore(getAdmin(), userId, data.user?.email ?? null);
}
