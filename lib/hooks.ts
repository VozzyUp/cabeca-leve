"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Carrega um recurso da API. O setState só acontece no retorno da promessa
// (regra do React 19: nada de setState síncrono dentro de efeito).
// combine: junta o que chegou do servidor com o que está na tela (ex.: mensagens ainda saindo)
export function useResource<T>(fetcher: () => Promise<T>, combine?: (fresh: T, current: T | null) => T) {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    fetcher().then(
      (data) => { if (alive) setState((s) => ({ data: combine ? combine(data, s.data) : data, error: false })); },
      () => { if (alive) setState((s) => ({ ...s, error: true })); },
    );
    return () => { alive = false; };
  }, [fetcher, version]);  // eslint-disable-line react-hooks/exhaustive-deps -- combine é fixo por tela
  const reload = useCallback(() => { setState((s) => ({ ...s, error: false })); setVersion((v) => v + 1); }, []);
  // mudou em outro aparelho (components/realtime-sync.tsx): busca de novo, sem piscar a tela
  useEffect(() => {
    window.addEventListener("app:data-changed", reload);
    return () => window.removeEventListener("app:data-changed", reload);
  }, [reload]);
  const setData = useCallback((fn: (d: T | null) => T | null) => setState((s) => ({ ...s, data: fn(s.data) })), []);
  return { data: state.data, error: state.error, reload, setData };
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
