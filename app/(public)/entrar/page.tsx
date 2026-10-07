import { SignIn } from "@/components/screens/sign-in";

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const { conta, modo } = await searchParams;
  const notice = conta === "excluida" ? "Sua conta e todos os dados foram excluídos." : null;
  const mode = modo === "criar" ? "signup" : modo === "senha" ? "reset" : "signin";
  return <div className="flex flex-1 items-start justify-center pt-8"><SignIn initialMode={mode} notice={notice} /></div>;
}
