import { serverPublicEnv } from "@/lib/public-env";

// O app tem dois modos: com Supabase (login e banco de verdade) e de demonstração
// (sem variáveis: dados de exemplo num arquivo local e sem login).
export function supabaseEnv() {
  const { supabaseUrl: url, supabaseKey: publishableKey } = serverPublicEnv();
  return url && publishableKey ? { url, publishableKey } : null;
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;
