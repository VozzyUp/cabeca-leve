"use client";
import { LoadError } from "@/components/ui/load-error";

// Falha ao carregar uma tela do servidor: mensagem e nova tentativa, o menu continua funcionando
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return <LoadError what="carregar esta tela" onRetry={retry} />;
}
