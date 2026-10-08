"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/data";
import { api } from "@/lib/api";

// Aviso de lembrete na tela enquanto o app está aberto. Com o servidor ligado
// (serverDelivery), quem marca e manda push e WhatsApp é a varredura do servidor
// (lib/deliveries.ts); aqui só aparece o aviso. No modo de demonstração, este
// componente faz tudo.
export function ReminderWatcher({ serverDelivery = false }: { serverDelivery?: boolean }) {
  const seen = useRef(new Set<string>());
  const [shown, setShown] = useState<string | null>(null);
  const browserPermission = useSyncExternalStore(
    () => () => {},
    () => ("Notification" in window ? Notification.permission : "unsupported"),
    () => "unsupported" as const,
  );
  const [answered, setAnswered] = useState<NotificationPermission | null>(null);
  const permission = answered ?? browserPermission;
  const firing = useRef(false);

  useEffect(() => {
    async function check() {
      if (firing.current) return;
      firing.current = true;
      try {
        const { reminders } = await api.reminders();
        const now = Date.now();
        for (const r of reminders) {
          if (r.status !== "active" || !r.nextFireAt) continue;
          const due = new Date(r.nextFireAt).getTime();
          if (serverDelivery) {
            // só os que venceram nos últimos 2 minutos, uma vez por aba (o push já foi pelo servidor)
            if (due > now || now - due > 120_000 || seen.current.has(r.id + r.nextFireAt)) continue;
            seen.current.add(r.id + r.nextFireAt);
            setShown(r.title);
            continue;
          }
          if (r.lastFiredAt || due > now) continue;
          await api.updateReminder(r.id, { lastFiredAt: new Date().toISOString() });
          setShown(r.title);
          if ("Notification" in window && Notification.permission === "granted") new Notification("Lembrete", { body: r.title });
        }
      } catch { /* sem rede: tenta na próxima volta */ } finally {
        firing.current = false;
      }
    }
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [serverDelivery]);

  return (
    <div className="fixed bottom-24 right-4 z-20 flex flex-col items-end gap-2 lg:bottom-6">
      {permission === "default" && !serverDelivery && (
        <Toast action={<Button size="sm" variant="ghost" onClick={async () => setAnswered(await Notification.requestPermission())}>Ativar</Button>}>
          Quer receber os lembretes como notificação?
        </Toast>
      )}
      {shown && (
        <Toast action={<Button size="sm" variant="ghost" onClick={() => setShown(null)}>Fechar</Button>}>
          Lembrete: {shown}
        </Toast>
      )}
    </div>
  );
}
