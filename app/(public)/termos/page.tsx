import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { termsSections } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Termos de uso · ${BRAND.name}` };

export default function Page() {
  return <LegalPage title="Termos de uso" intro="As regras do serviço: teste, assinatura, cancelamento, o que o assistente pode e não pode fazer."
    sections={termsSections()} other={{ href: "/privacidade", label: "Política de privacidade" }} />;
}
