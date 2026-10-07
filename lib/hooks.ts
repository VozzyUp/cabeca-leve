"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Carrega um recurso da API. O setState só acontece no retorno da promessa
// (regra do React 19: nada de setState síncrono dentro de efeito).
export function useResource<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    fetcher().then(
      (data) => { if (alive) setState({ data, error: false }); },
      () => { if (alive) setState((s) => ({ ...s, error: true })); },
    );
    return () => { alive = false; };
  }, [fetcher, version]);
  const reload = useCallback(() => { setState((s) => ({ ...s, error: false })); setVersion((v) => v + 1); }, []);
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
