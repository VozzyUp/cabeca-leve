// Reconhecimento de voz do navegador (Chrome, Edge e Safari usam o prefixo webkit).
// Tipos mínimos: o TypeScript ainda não traz os do Web Speech API.
export type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecognitionCtor = new () => Recognition;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// para useSyncExternalStore: o suporte não muda depois de carregar
export const noSubscribe = () => () => {};
export const speechSupported = () => getRecognitionCtor() !== null;
