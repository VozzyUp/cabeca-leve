"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";

type Mode = "signin" | "signup" | "reset" | "newPassword";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLE: Record<Mode, string> = { signin: "Entrar", signup: "Criar conta", reset: "Recuperar a senha", newPassword: "Criar senha nova" };
const SUBMIT: Record<Mode, string> = { signin: "Entrar", signup: "Criar conta", reset: "Mandar o link", newPassword: "Salvar a senha" };

// S31: entrar, criar conta, recuperar senha e definir a senha nova (Supabase Auth).
// No modo de demonstração (sem Supabase), entrar só leva ao app.
export function SignIn({ initialMode, notice, demo, next, plan }: {
  initialMode: Mode; notice: string | null; demo: boolean; next: string; plan: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "reset" | "signup">(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: typeof errors = {};
    if (mode === "signup" && !form.name.trim()) err.name = "Diga como quer ser chamado.";
    if (mode !== "newPassword" && !EMAIL.test(form.email.trim())) err.email = "Confira o e-mail, como nome@exemplo.com.br.";
    if (mode !== "reset" && form.password.length < 8) err.password = "A senha precisa de pelo menos 8 caracteres.";
    setErrors(err);
    setServerError(null);
    if (Object.keys(err).length) return;
    const email = form.email.trim();
    start(async () => {
      if (demo) {
        if (mode === "reset") setSent("reset");
        else router.push(mode === "signup" ? "/planos?novo=1" : next);
        return;
      }
      const r = mode === "signin" ? await signIn({ email, password: form.password })
        : mode === "signup" ? await signUp({ name: form.name, email, password: form.password, plan: plan ?? undefined })
        : mode === "reset" ? await requestPasswordReset({ email })
        : await updatePassword({ password: form.password });
      if (!r.ok) { setServerError(r.error); return; }
      if (mode === "signup") setSent("signup");
      else if (mode === "reset") setSent("reset");
      else { router.push(mode === "newPassword" ? "/conversa" : next); router.refresh(); }
    });
  }
  const change = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const go = (m: Mode) => { setMode(m); setErrors({}); setServerError(null); };

  return (
    <Card className="mx-auto flex w-full max-w-sm flex-col gap-5 p-6">
      <h1 className="text-2xl font-bold text-text">{TITLE[mode]}</h1>
      {notice && <p role="status" className="rounded-md bg-surface-2 px-3 py-2 text-sm text-body">{notice}</p>}
      {(mode === "signin" || mode === "signup") && !sent && (
        <Segmented label="Entrar ou criar conta" value={mode} onChange={go}
          options={[{ value: "signin", label: "Entrar" }, { value: "signup", label: "Criar conta" }]} />
      )}
      {sent ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm text-body">
            {sent === "reset"
              ? <>Se existir uma conta com <strong className="text-text">{form.email.trim()}</strong>, mandamos um link para criar uma senha nova. Confira também o spam.</>
              : <>Quase lá: mandamos um link de confirmação para <strong className="text-text">{form.email.trim()}</strong>. Abra o e-mail e toque no link para ativar a conta.</>}
          </p>
          <Button variant="secondary" onClick={() => { go("signin"); setSent(null); }}>Voltar para entrar</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {mode === "signup" && <Field label="Seu nome" autoComplete="given-name" value={form.name} onChange={change("name")} error={errors.name} />}
          {mode !== "newPassword" && (
            <Field label="E-mail" type="email" autoComplete="email" value={form.email} onChange={change("email")} error={errors.email}
              hint={mode === "signup" ? "Use o mesmo e-mail do pagamento." : undefined} />
          )}
          {mode !== "reset" && (
            <Field label={mode === "newPassword" ? "Senha nova" : "Senha"} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={form.password} onChange={change("password")} error={errors.password} hint={mode === "signin" ? undefined : "Pelo menos 8 caracteres."} />
          )}
          {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
          <Button type="submit" size="lg" loading={pending}>{SUBMIT[mode]}</Button>
          {mode === "signin" && <button type="button" onClick={() => go("reset")} className="text-sm font-medium text-info hover:underline">Esqueci a senha</button>}
          {mode === "reset" && <button type="button" onClick={() => go("signin")} className="text-sm font-medium text-info hover:underline">Lembrei a senha</button>}
        </form>
      )}
    </Card>
  );
}
