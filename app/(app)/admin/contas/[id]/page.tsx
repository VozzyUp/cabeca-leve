import { AdminAccountScreen } from "@/components/screens/admin-account-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AdminAccountScreen id={(await params).id} />;
}
