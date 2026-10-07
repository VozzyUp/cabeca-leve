import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Cliente com a sessão de quem está usando (cookies). Serve para saber QUEM é o usuário;
// as escritas passam pelo cliente de serviço filtrando sempre por user_id.
export async function createSessionClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase não configurado");
  const store = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // num Server Component não dá para gravar cookie; o proxy renova a sessão
        try { for (const { name, value, options } of list) store.set(name, value, options); } catch {}
      },
    },
  });
}

// Cliente de serviço: ignora o RLS. Só no servidor, e todo acesso filtra por user_id.
let admin: ReturnType<typeof createClient<Database>> | null = null;
export function getAdmin() {
  const env = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) throw new Error("Supabase não configurado");
  admin ??= createClient<Database>(env.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export type Admin = ReturnType<typeof getAdmin>;

// Usuário da sessão atual (getUser confere o token no servidor de Auth, não só o cookie)
export async function currentUser() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
