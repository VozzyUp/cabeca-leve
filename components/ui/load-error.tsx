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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-label text-muted">{id}</p>
        <h1 className="text-[28px] font-bold leading-[34px]">{title}</h1>
      </div>
      {children}
    </header>
  );
}
