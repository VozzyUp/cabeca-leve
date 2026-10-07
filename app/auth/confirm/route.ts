import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

// Link dos e-mails de confirmação e de nova senha. Aceita o fluxo PKCE (?code=) e o de
// token (?token_hash=&type=), e só redireciona para caminhos do próprio app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const raw = searchParams.get("next") ?? "/conversa";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/conversa";
  const supabase = await createSessionClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash }) : { error: new Error("link inválido") };
  if (error) return NextResponse.redirect(`${origin}/entrar?link=invalido`);
  return NextResponse.redirect(`${origin}${next}`);
}
