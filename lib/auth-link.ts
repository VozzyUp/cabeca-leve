import type { EmailOtpType } from "@supabase/supabase-js";

// Link dos e-mails do Supabase Auth: o e-mail leva a /auth/confirmar (uma página com botão) e só o toque no
// botão gasta o link. Assim o leitor de links do provedor de e-mail não "queima" o link antes da pessoa, e o link
// funciona em qualquer aparelho ou navegador (não depende do cookie de quem se cadastrou, como o fluxo PKCE).

const TYPES = ["signup", "email", "recovery", "email_change", "invite", "magiclink"] as const;

export const otpType = (raw: unknown): EmailOtpType | null =>
  typeof raw === "string" && (TYPES as readonly string[]).includes(raw) ? (raw as EmailOtpType) : null;

export const tokenHash = (raw: unknown): string | null =>
  typeof raw === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(raw) ? raw : null;

export const CONFIRM_TITLE: Record<string, string> = {
  signup: "Confirmar meu e-mail", email: "Confirmar meu e-mail", recovery: "Criar uma senha nova",
  email_change: "Confirmar o e-mail novo", invite: "Entrar", magiclink: "Entrar",
};
