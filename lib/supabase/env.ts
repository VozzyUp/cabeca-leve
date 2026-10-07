// O app tem dois modos: com Supabase (login e banco de verdade) e de demonstração
// (sem variáveis: dados de exemplo num arquivo local e sem login).
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;
