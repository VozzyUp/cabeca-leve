"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";

type Mode = "signin" | "signup" | "reset";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// S31: entrar, criar conta e recuperar senha. A validação é a definitiva; a autenticação
// (Supabase Auth) entra no /replica-backend. Até lá, entrar só leva ao app.
export function SignIn({ initialMode, notice }: { initialMode: Mode; notice: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (mode === "signup" && !form.name.trim()) next.name = "Diga como quer ser chamado.";
    if (!EMAIL.test(form.email.trim())) next.email = "Confira o e-mail, como nome@exemplo.com.br.";
    if (mode !== "reset" && form.password.length < 8) next.password = "A senha precisa de pelo menos 8 caracteres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (mode === "reset") { setSent(true); return; }
    setPending(true);
    router.push(mode === "signup" ? "/planos?novo=1" : "/conversa");
  }
  const change = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card className="mx-auto flex w-full max-w-sm flex-col gap-5 p-6">
      <h1 className="text-2xl font-bold text-text">{mode === "signup" ? "Criar conta" : mode === "reset" ? "Recuperar a senha" : "Entrar"}</h1>
      {notice && <p role="status" className="rounded-md bg-surface-2 px-3 py-2 text-sm text-body">{notice}</p>}
      {mode !== "reset" && (
        <Segmented label="Entrar ou criar conta" value={mode} onChange={(m) => { setMode(m); setErrors({}); }}
          options={[{ value: "signin", label: "Entrar" }, { value: "signup", label: "Criar conta" }]} />
      )}
      {sent ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm text-body">Se existir uma conta com <strong className="text-text">{form.email.trim()}</strong>, mandamos um link para criar uma senha nova. Confira também o spam.</p>
          <Button variant="secondary" onClick={() => { setMode("signin"); setSent(false); }}>Voltar para entrar</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {mode === "signup" && <Field label="Seu nome" autoComplete="given-name" value={form.name} onChange={change("name")} error={errors.name} />}
          <Field label="E-mail" type="email" autoComplete="email" value={form.email} onChange={change("email")} error={errors.email}
            hint={mode === "signup" ? "Use o mesmo e-mail do pagamento." : undefined} />
          {mode !== "reset" && (
            <Field label="Senha" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={form.password} onChange={change("password")} error={errors.password} hint={mode === "signup" ? "Pelo menos 8 caracteres." : undefined} />
          )}
          <Button type="submit" size="lg" loading={pending}>{mode === "signup" ? "Criar conta" : mode === "reset" ? "Mandar o link" : "Entrar"}</Button>
          {mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setErrors({}); }} className="text-sm font-medium text-info hover:underline">Esqueci a senha</button>}
          {mode === "reset" && <button type="button" onClick={() => setMode("signin")} className="text-sm font-medium text-info hover:underline">Lembrei a senha</button>}
        </form>
      )}
    </Card>
  );
}
