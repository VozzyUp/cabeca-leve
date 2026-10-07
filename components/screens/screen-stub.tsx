import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/data";
import { screenById } from "@/lib/screens";

// Esboço de tela ainda não construída: mostra o propósito e em que etapa ela chega
export function ScreenStub({ id }: { id: string }) {
  const s = screenById(id);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-label text-muted">{s.id}</p>
        <h1 className="text-[28px] font-bold leading-[34px]">{s.title}</h1>
      </header>
      <EmptyState icon={<Hammer className="size-8" />} title="Tela em construção"
        text={`${s.purpose} Chega na etapa ${s.milestone} do plano.`} />
    </div>
  );
}
