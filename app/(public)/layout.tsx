import Link from "next/link";

// Páginas abertas (entrar, planos): cabeçalho simples, sem a navegação do app.
// Nome provisório até o /replica-brand.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/planos" className="text-lg font-bold text-text">Assistente</Link>
        <nav aria-label="Conta" className="flex gap-4 text-sm font-medium">
          <Link href="/planos" className="text-body hover:text-text">Planos</Link>
          <Link href="/entrar" className="text-body hover:text-text">Entrar</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-16 pt-6 lg:px-8">{children}</main>
    </div>
  );
}
