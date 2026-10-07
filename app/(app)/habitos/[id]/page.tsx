import { HabitDetailScreen } from "@/components/screens/health-screens";

export default async function Page({ params }: PageProps<"/habitos/[id]">) {
  const { id } = await params;
  return <HabitDetailScreen id={id} />;
}
