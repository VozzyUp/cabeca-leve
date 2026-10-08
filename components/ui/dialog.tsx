"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./button";

// Janela de edição. O <dialog> nativo com showModal() prende o foco, fecha com Esc e
// devolve o foco ao botão que abriu. No celular ocupa a parte de baixo da tela.
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-0 mt-auto w-full max-w-none rounded-t-xl border border-border bg-surface p-0 text-text shadow-pop backdrop:bg-black/60 sm:m-auto sm:max-w-lg sm:rounded-xl">
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
            <IconButton label="Fechar" onClick={onClose}><X className="size-5" /></IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
