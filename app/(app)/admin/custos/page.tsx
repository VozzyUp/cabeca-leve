import { AdminCostsScreen } from "@/components/screens/admin-costs";

export default async function Page({ searchParams }: { searchParams: Promise<{ periodo?: string | string[] }> }) {
  const { periodo } = await searchParams;
  return <AdminCostsScreen period={typeof periodo === "string" ? periodo : undefined} />;
}
