import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";
import { privacySections } from "@/lib/legal";

export const dynamic = "force-dynamic";  // os dados da empresa vêm da configuração do admin
export const metadata: Metadata = { title: `Política de privacidade · ${BRAND.name}` };

export default function Page() {
  return <LegalPage title="Política de privacidade" intro="Aqui está, em linguagem simples, quais dados o assistente guarda, para que, com quem e como você controla tudo."
    sections={privacySections()} other={{ href: "/termos", label: "Termos de uso" }} />;
}
