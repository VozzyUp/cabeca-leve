"use client";
import "./globals.css";

// Último recurso: erro no layout raiz. Precisa do próprio <html>; recarregar busca a versão nova do app.
export default function GlobalError() {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center font-sans text-text">
        <h1 className="text-2xl font-bold">Algo saiu do lugar</h1>
        <p className="max-w-md text-sm text-body">Não deu para abrir agora. Se o app acabou de ser atualizado, recarregar costuma resolver. Nada do que você anotou se perdeu.</p>
        <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">Recarregar</button>
      </body>
    </html>
  );
}
