"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/data";
import { api } from "@/lib/api";

// Aviso de lembrete enquanto o app está aberto (S35 parcial). O push com o app
// fechado (Web Push + fila) e o WhatsApp chegam no /replica-backend.
export function ReminderWatcher() {
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
          if (r.status !== "active" || !r.nextFireAt || r.lastFiredAt || new Date(r.nextFireAt).getTime() > now) continue;
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
  }, []);

  return (
    <div className="fixed bottom-24 right-4 z-20 flex flex-col items-end gap-2 lg:bottom-6">
      {permission === "default" && (
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
