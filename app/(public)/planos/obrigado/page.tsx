import Link from "next/link";
import { Card } from "@/components/ui/card";

// Volta da página de pagamento. A liberação vem do webhook da Asaas, não deste endereço.
export default function Page() {
  return (
    <Card className="mx-auto mt-8 flex max-w-md flex-col gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold text-text">Pagamento recebido</h1>
      <p className="text-body">Assim que a Asaas confirmar (no Pix é na hora; no cartão, em instantes), seu plano aparece em Ajustes.</p>
      <Link href="/conversa" className="mx-auto inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">Voltar para o assistente</Link>
    </Card>
  );
}
