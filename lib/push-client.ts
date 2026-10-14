import { clientPublicEnv } from "@/lib/public-env";
// Inscrição deste navegador no Web Push (roda no cliente)
const key = () => clientPublicEnv().vapidPublicKey;

function toUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!key();

// iPhone e iPad: notificação só no app adicionado à Tela de Início (iOS 16.4+), nunca na aba do Safari
export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

// O que dá para fazer neste aparelho, para a tela explicar em vez de falhar calada
export type PushAvailability = "ok" | "ios-install" | "ios-update" | "unsupported" | "not-configured";
export function pushAvailability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!key()) return "not-configured";
  if (isIos() && !isInstalled()) return "ios-install";
  if (isIos() && !("PushManager" in window)) return "ios-update";  // instalado, mas iOS antigo (antes do 16.4)
  return pushSupported() ? "ok" : "unsupported";
}

// Já autorizado: garante que a inscrição deste aparelho está no servidor (o iOS às vezes troca o endereço)
export async function refreshPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.register("/sw.js");
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(key()!) });
  await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
}

export async function subscribePush(): Promise<"ok" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js");
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(key()!) });
  const res = await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return res.ok ? "ok" : "unsupported";
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}
