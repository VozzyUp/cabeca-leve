import { PaymentStatus } from "@/components/screens/payment-status";
import { Card } from "@/components/ui/card";
import { markCheckoutReturned } from "@/lib/billing/asaas";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

// Volta da página de pagamento. Quem libera o plano é o webhook da Asaas; enquanto ele não chega,
// marcar a volta deixa a pessoa usar o app por até 2 h (F2), em vez de "assinatura inválida".
export default async function Page() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (user) await markCheckoutReturned(user.id);
  return (
    <Card className="mx-auto mt-8 flex max-w-md flex-col gap-3 p-6 text-center">
      <PaymentStatus signedIn={!!user} />
    </Card>
  );
}
