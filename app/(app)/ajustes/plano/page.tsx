import { MyPlanScreen } from "@/components/screens/my-plan-screen";

export default async function Page({ searchParams }: PageProps<"/ajustes/plano">) {
  const { erro } = await searchParams;
  return <MyPlanScreen paymentError={erro === "pagamento"} />;
}
