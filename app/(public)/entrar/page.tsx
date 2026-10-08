import { SignIn } from "@/components/screens/sign-in";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeAppPath } from "@/lib/validation";

const NOTICE: Record<string, string> = {
  excluida: "Sua conta e todos os dados foram excluídos.",
  invalido: "Esse link expirou ou já foi usado. Peça outro.",
};

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const { conta, modo, link, voltar, plano } = await searchParams;
  const notice = conta === "excluida" ? NOTICE.excluida : link === "invalido" ? NOTICE.invalido : null;
  const mode = modo === "criar" ? "signup" : modo === "senha" ? "reset" : "signin";
  // só caminhos do próprio app
  const next = safeAppPath(voltar);
  return (
    <div className="flex flex-1 items-start justify-center pt-8">
      <SignIn initialMode={mode} notice={notice} demo={!isSupabaseConfigured()} next={next} plan={typeof plano === "string" ? plano : null} />
    </div>
  );
}
