"use client";
import { useEffect } from "react";

// Aplica o tema escolhido em Ajustes no <html>. Sem atributo vale o escuro (padrão dos tokens).
export function ThemeSync({ theme }: { theme: "dark" | "light" | "system" }) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme !== "system") { root.dataset.theme = theme; return; }
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => { root.dataset.theme = mq.matches ? "light" : "dark"; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
