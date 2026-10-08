// Valores públicos (podem ir para o navegador): endereço e chave publicável do Supabase,
// endereço do site e chave pública do push. São lidos quando o app RODA, não no build: assim
// a mesma imagem Docker serve em qualquer ambiente, configurada só pelas variáveis do Portainer.
// Os nomes sem prefixo valem na VPS; os NEXT_PUBLIC_* continuam valendo no desenvolvimento.
export type PublicEnv = { supabaseUrl: string | null; supabaseKey: string | null; siteUrl: string; vapidPublicKey: string | null };

declare global {
  interface Window { __ENV__?: PublicEnv }
}

export function serverPublicEnv(): PublicEnv {
  const e = process.env;  // acesso indireto: o Next não troca pelo valor do build
  return {
    supabaseUrl: e.SUPABASE_URL || e["NEXT_PUBLIC_SUPABASE_URL"] || null,
    supabaseKey: e.SUPABASE_PUBLISHABLE_KEY || e["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] || null,
    siteUrl: (e.SITE_URL || e["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000").replace(/\/$/, ""),
    vapidPublicKey: e.VAPID_PUBLIC_KEY || e["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || null,
  };
}

// No navegador: vem de /env.js, carregado no <head> antes de tudo (app/layout.tsx)
export function clientPublicEnv(): PublicEnv {
  return (typeof window !== "undefined" && window.__ENV__) || { supabaseUrl: null, supabaseKey: null, siteUrl: "", vapidPublicKey: null };
}

export const siteUrl = () => serverPublicEnv().siteUrl;
