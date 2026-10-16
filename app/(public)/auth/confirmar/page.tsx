import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CONFIRM_TITLE, otpType, tokenHash } from "@/lib/auth-link";
import { safeAppPath } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Para onde o link do e-mail aponta. Só o toque no botão (POST em /auth/confirm) usa o link.
export default async function Page({ searchParams }: PageProps<"/auth/confirmar">) {
  const { token_hash, type, next } = await searchParams;
  const hash = tokenHash(token_hash);
  const kind = otpType(type);
  if (!hash || !kind) redirect("/entrar?link=invalido");
  const nextPath = typeof next === "string" ? safeAppPath(next, "") : "";
  const label = CONFIRM_TITLE[kind];
  return (
    <div className="flex flex-1 items-start justify-center pt-8">
      <Card className="mx-auto flex w-full max-w-sm flex-col gap-5 p-6">
        <h1 className="text-2xl font-bold text-text">{kind === "recovery" ? "Criar uma senha nova" : "Falta só um toque"}</h1>
        <p className="text-sm text-body">
          {kind === "recovery" ? "Toque no botão para continuar e escolher a senha nova." : "Toque no botão para concluir e entrar no Peraí."}
        </p>
        <form method="post" action="/auth/confirm" className="flex flex-col gap-3">
          <input type="hidden" name="token_hash" value={hash} />
          <input type="hidden" name="type" value={kind} />
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <button type="submit" className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-5 text-base font-semibold text-on-accent hover:opacity-90 active:opacity-80">
            {label}
          </button>
        </form>
      </Card>
    </div>
  );
}
