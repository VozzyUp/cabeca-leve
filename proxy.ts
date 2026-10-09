import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/public-env";
import { supabaseEnv } from "@/lib/supabase/env";

// Rotas abertas: início, login, planos, termos e privacidade, confirmação de e-mail e quem se autentica de outro jeito
// (webhooks com assinatura, filas com assinatura do QStash, varreduras com CRON_SECRET).
const PUBLIC = [/^\/$/, /^\/entrar/, /^\/planos/, /^\/privacidade/, /^\/termos/, /^\/auth\//, /^\/design/, /^\/api\/webhooks\//, /^\/api\/jobs\//, /^\/api\/cron\//, /^\/api\/health/];

// Renova a sessão (cookies) a cada pedido e barra quem não entrou. É a checagem
// otimista; cada rota e tela confere o usuário de novo ao ler os dados.
export async function proxy(request: NextRequest) {
  const env = supabaseEnv();
  if (!env) return NextResponse.next();  // modo de demonstração: sem login

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (user || PUBLIC.some((r) => r.test(path))) return response;

  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  // endereço público (SITE_URL): atrás do Traefik o app recebe http e o host interno
  const url = new URL("/entrar", siteUrl());
  if (path !== "/") url.search = `?voltar=${encodeURIComponent(path)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|env.js|api/health|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
