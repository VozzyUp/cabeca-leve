"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Status = "confirming" | "active" | "slow";

// Acompanha a confirmação da Asaas sem prender a pessoa: o app já está liberado enquanto isso
export function PaymentStatus({ signedIn }: { signedIn: boolean }) {
  const [status, setStatus] = useState<Status>("confirming");
  useEffect(() => {
    if (!signedIn) return;
    let alive = true, tries = 0;
    const tick = async () => {
      tries++;
      const r = await fetch("/api/billing/status").then((x) => x.json()).catch(() => null) as { active?: boolean } | null;
      if (!alive) return;
      if (r?.active) { setStatus("active"); return; }
      if (tries >= 40) { setStatus("slow"); return; }  // ~2 minutos
      setTimeout(tick, 3000);
    };
    tick();
    return () => { alive = false; };
  }, [signedIn]);

  const title = { confirming: "Confirmando o pagamento…", active: "Plano ativo", slow: "Ainda confirmando" }[status];
  const text = {
    confirming: "No Pix é na hora; no cartão, em instantes. Você já pode usar o app enquanto isso.",
    active: "Pagamento confirmado. Obrigado! Tudo liberado.",
    slow: "A confirmação está demorando mais que o normal. Seu acesso continua liberado; se em 2 horas não aparecer em Ajustes, fale com uma pessoa do time.",
  }[status];
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      <p className="text-body">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/conversa" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">Ir para o assistente</Link>
        {status === "slow" && <Link href="/ajustes/suporte" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-text">Falar com uma pessoa</Link>}
      </div>
    </div>
  );
}
