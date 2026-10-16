"use client";
import { useEffect } from "react";

// Tela fixa como um app (iPhone e Android): o zoom não existe e a página não sai do lugar.
// O iPhone ignora parte do que o CSS e o viewport pedem, então aqui o resto é feito à mão:
// - corta o gesto de pinça do iPhone (gesturestart/gesturechange); o toque duplo já não dá zoom (touch-action: manipulation);
// - se mesmo assim a página ficar ampliada ou deslocada (zoom do campo, teclado que fechou), devolve ao lugar.
const VIEWPORT = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";

export function StandaloneGuard() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;  // computador: nada muda
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    document.addEventListener("gestureend", stop);
    const viewport = window.visualViewport;
    let fixing = false;
    const settle = () => {
      if (!viewport || fixing) return;
      const zoomed = viewport.scale > 1.01;
      const shifted = window.scrollX !== 0 || Math.abs(viewport.offsetLeft) > 1;
      if (!zoomed && !shifted) return;
      fixing = true;
      if (zoomed) {
        // reescrever o viewport faz o iPhone voltar à escala 1
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta) { meta.setAttribute("content", `${VIEWPORT.replace("maximum-scale=1", "maximum-scale=1.0001")}`); requestAnimationFrame(() => meta.setAttribute("content", VIEWPORT)); }
      }
      window.scrollTo(0, window.scrollY);
      setTimeout(() => { fixing = false; }, 250);
    };
    viewport?.addEventListener("resize", settle);
    viewport?.addEventListener("scroll", settle);
    window.addEventListener("orientationchange", settle);
    document.addEventListener("focusout", () => setTimeout(settle, 120));
    settle();
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      viewport?.removeEventListener("resize", settle);
      viewport?.removeEventListener("scroll", settle);
      window.removeEventListener("orientationchange", settle);
    };
  }, []);
  return null;
}
