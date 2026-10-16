"use client";
import { useEffect } from "react";

// App na tela inicial (iPhone e Android): a tela fica parada. Só atua com o app instalado; no navegador comum
// o zoom e a rolagem seguem livres (acessibilidade).
// - iPhone ignora touch-action para o zoom de pinça: aqui o gesto é cortado.
// - Quando o teclado fecha, o iPhone deixa a página deslocada: volta ao lugar.
export function StandaloneGuard() {
  useEffect(() => {
    const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (!installed) return;
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    const viewport = window.visualViewport;
    const settle = () => {
      if (!viewport || viewport.scale > 1.01) return;
      if (window.scrollX !== 0 || viewport.offsetLeft !== 0) window.scrollTo(0, window.scrollY);
    };
    viewport?.addEventListener("resize", settle);
    viewport?.addEventListener("scroll", settle);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      viewport?.removeEventListener("resize", settle);
      viewport?.removeEventListener("scroll", settle);
    };
  }, []);
  return null;
}
