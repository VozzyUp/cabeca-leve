"use client";
import { useEffect } from "react";
import { refreshPushSubscription } from "@/lib/push-client";

// Com as notificações ligadas e já autorizadas, confere a inscrição deste aparelho a cada abertura
// do app: o iPhone pode trocar o endereço de entrega, e sem isso os avisos param sem ninguém saber.
export function PushKeeper({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) refreshPushSubscription().catch(() => {});
  }, [enabled]);
  return null;
}
