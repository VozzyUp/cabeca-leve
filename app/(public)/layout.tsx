import Link from "next/link";
import { BRAND } from "@/lib/brand";

// Páginas abertas (início, entrar, planos, termos): cabeçalho e rodapé simples, sem a navegação do app.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/" className="text-lg font-bold text-text">{BRAND.name}</Link>
        <nav aria-label="Conta" className="flex gap-4 text-sm font-medium">
          <Link href="/planos" className="text-body hover:text-text">Planos</Link>
          <Link href="/entrar" className="text-body hover:text-text">Entrar</Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-16 pt-6 lg:px-8">{children}</main>
      <footer className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-sm text-muted lg:px-8">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <nav aria-label="Informações legais" className="flex gap-4">
          <Link href="/privacidade" className="hover:text-text">Privacidade</Link>
          <Link href="/termos" className="hover:text-text">Termos de uso</Link>
        </nav>
      </footer>
    </div>
  );
}
