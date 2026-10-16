import { redirect } from "next/navigation";
import { CheckoutScreen } from "@/components/screens/checkout";
import { planById } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { serverContext } from "@/lib/server";

// Assinar: escolher Pix, boleto ou cartão e pagar sem sair do app
export default async function Page({ params }: PageProps<"/assinar/[plano]">) {
  const { plano } = await params;
  const plan = planById(await loadPlans(), plano);
  if (!plan || plan.kind !== "paid" || !plan.active) redirect("/planos?indisponivel=1");
  const { store } = await serverContext({ allowLocked: true });
  const settings = await store.getSettings();
  return <CheckoutScreen plan={plan} name={settings.name === "você" ? "" : settings.name} trialEndsOn={settings.trialEndsOn} />;
}
