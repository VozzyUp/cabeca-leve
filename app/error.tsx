"use client";
import { Button } from "@/components/ui/button";

// Falha fora de uma tela (por exemplo, no carregamento do layout logado, logo depois de uma
// atualização do app): mensagem clara e nova tentativa, em vez do "Internal Server Error" cru
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-text">Algo saiu do lugar</h1>
      <p className="text-sm text-body">Não deu para abrir agora. Se o app acabou de ser atualizado, tentar de novo costuma resolver. Nada do que você anotou se perdeu.</p>
      <div className="flex gap-2">
        <Button onClick={retry}>Tentar de novo</Button>
        {/* link comum (não o do Next): recarrega a página inteira e pega a versão nova do app */}
        <a href="/conversa" className="inline-flex h-10 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold text-text hover:bg-surface-3">Voltar para a conversa</a>
      </div>
    </main>
  );
}
