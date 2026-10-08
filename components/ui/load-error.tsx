import { Button } from "./button";

// Falha ao carregar ou salvar, com nova tentativa
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-danger px-4 py-3 text-sm">
      Não deu para {what}.
      <Button size="sm" variant="secondary" onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}

export function PageHeader({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    // id da tela (S01…) fica só no HTML, para testes e o mapa do recon; não aparece para a pessoa
    <header data-screen={id} className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-[34px]">{title}</h1>
      </div>
      {children}
    </header>
  );
}
