"use server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/public-env";

// Login, cadastro e senha pelo Supabase Auth. Mensagens em pt-BR; nunca dizemos se um
// e-mail tem conta (evita descobrir quem usa o app).

const site = siteUrl;
const email = z.email().max(254);
const password = z.string().min(8).max(72);
type Result = { ok: true } | { ok: false; error: string };

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme o e-mail antes de entrar: mandamos um link para a sua caixa de entrada.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  if (/weak|pwned|password/i.test(message)) return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
  return "Algo deu errado. Tente de novo em instantes.";
}

export async function signIn(input: { email: string; password: string }): Promise<Result> {
  const parsed = z.object({ email, password: z.string().min(1).max(72) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira o e-mail e a senha." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function signUp(input: { name: string; email: string; password: string; plan?: string }): Promise<Result> {
  const parsed = z.object({ name: z.string().trim().min(1).max(80), email, password }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os dados do cadastro." };
  const supabase = await createSessionClient();
  const next = input.plan === "monthly" || input.plan === "yearly" ? `/planos?plano=${input.plan}` : "/conversa";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { name: parsed.data.name }, emailRedirectTo: `${site()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  // e-mail já cadastrado não vira erro: a resposta é a mesma (o Supabase não reenvia nada)
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function requestPasswordReset(input: { email: string }): Promise<Result> {
  const parsed = email.safeParse(input.email);
  if (!parsed.success) return { ok: false, error: "Confira o e-mail." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${site()}/auth/confirm?next=/entrar/nova-senha` });
  if (error && /rate limit|too many/i.test(error.message)) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

export async function updatePassword(input: { password: string }): Promise<Result> {
  const parsed = password.safeParse(input.password);
  if (!parsed.success) return { ok: false, error: "A senha precisa de pelo menos 8 caracteres." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

// Sair: neste aparelho ou em todos
export async function signOut(everywhere = false): Promise<Result> {
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signOut({ scope: everywhere ? "global" : "local" });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
