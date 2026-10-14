// Valores públicos (podem ir para o navegador): endereço e chave publicável do Supabase,
// endereço do site e chave pública do push. São lidos quando o app RODA, não no build: assim
// a mesma imagem Docker serve em qualquer ambiente, configurada só pelas variáveis do Portainer.
// Os nomes sem prefixo valem na VPS; os NEXT_PUBLIC_* continuam valendo no desenvolvimento.
// Chave VAPID no formato que o web-push e o navegador exigem: base64 de URL, sem "=" (copiar e colar
// costuma trazer "+", "/" ou "=" no fim, e o envio falha com "must be a URL safe Base 64")
export const urlSafeKey = (k: string | null | undefined) =>
  k ? k.trim().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") || null : null;

// Chave pública VAPID de verdade: 65 bytes começando em 0x04 (ponto P-256 sem compressão), em base64 de URL
export function isVapidPublicKey(k: string | null | undefined) {
  const v = urlSafeKey(k);
  if (!v || !/^[A-Za-z0-9_-]+$/.test(v)) return false;
  try {
    const raw = atob(v.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (v.length % 4)) % 4));
    return raw.length === 65 && raw.charCodeAt(0) === 4;
  } catch { return false; }
}
// Chave privada VAPID: 32 bytes em base64 de URL
export function isVapidPrivateKey(k: string | null | undefined) {
  const v = urlSafeKey(k);
  if (!v || !/^[A-Za-z0-9_-]+$/.test(v)) return false;
  try { return atob(v.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (v.length % 4)) % 4)).length === 32; } catch { return false; }
}

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
    vapidPublicKey: isVapidPublicKey(e.VAPID_PUBLIC_KEY || e["NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) ? urlSafeKey(e.VAPID_PUBLIC_KEY || e["NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) : null,
  };
}

// No navegador: vem de /env.js, carregado no <head> antes de tudo (app/layout.tsx)
export function clientPublicEnv(): PublicEnv {
  return (typeof window !== "undefined" && window.__ENV__) || { supabaseUrl: null, supabaseKey: null, siteUrl: "", vapidPublicKey: null };
}

export const siteUrl = () => serverPublicEnv().siteUrl;
