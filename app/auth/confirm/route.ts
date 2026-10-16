import { NextResponse, type NextRequest } from "next/server";
import { otpType, tokenHash } from "@/lib/auth-link";
import { siteUrl } from "@/lib/public-env";
import { createSessionClient } from "@/lib/supabase/server";
import { safeAppPath } from "@/lib/validation";

// Link dos e-mails de confirmação e de nova senha. Atrás do Traefik, request.nextUrl teria http e o host interno,
// então os redirecionamentos usam siteUrl().
//  - GET ?code=            links antigos (fluxo PKCE): troca o código por sessão
//  - GET ?token_hash=&type= só leva à página /auth/confirmar, SEM gastar o link (leitores de e-mail abrem links por conta própria)
//  - POST token_hash+type   o toque no botão da página: valida o link e abre a sessão
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteUrl();
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? `${origin}/entrar?link=invalido` : `${origin}${safeAppPath(searchParams.get("next"))}`);
  }
  if (tokenHash(searchParams.get("token_hash")) && otpType(searchParams.get("type"))) {
    return NextResponse.redirect(`${origin}/auth/confirmar${request.nextUrl.search}`, 303);
  }
  return NextResponse.redirect(`${origin}/entrar?link=invalido`);
}

export async function POST(request: NextRequest) {
  const origin = siteUrl();
  const form = await request.formData().catch(() => null);
  const hash = tokenHash(form?.get("token_hash"));
  const type = otpType(form?.get("type"));
  if (!hash || !type) return NextResponse.redirect(`${origin}/entrar?link=invalido`, 303);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: hash });
  if (error) return NextResponse.redirect(`${origin}/entrar?link=invalido`, 303);
  // sem destino no link, vale o que a conta pediu ao se cadastrar (ex.: ir direto para um plano)
  const asked = form?.get("next") || data.user?.user_metadata?.next;
  return NextResponse.redirect(`${origin}${safeAppPath(asked, type === "recovery" ? "/entrar/nova-senha" : "/conversa")}`, 303);
}
