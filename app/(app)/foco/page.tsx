import { FocusScreen } from "@/components/screens/plan-screens";

// ?titulo= vem do card "a seguir" do Meu dia
export default async function Page({ searchParams }: PageProps<"/foco">) {
  const { titulo } = await searchParams;
  return <FocusScreen initialTitle={typeof titulo === "string" ? titulo.slice(0, 200) : ""} />;
}
