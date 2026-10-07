import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { screens } from "@/lib/screens";

// Celular: todas as seções que não cabem na barra inferior
export default function MorePage() {
  const items = screens.filter((s) => !["S31", "S32", "S03", "S13"].includes(s.id));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-bold leading-[34px]">Tudo</h1>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {items.map((s) => (
          <li key={s.id}>
            <Link href={s.path} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="flex flex-col">
                <span className="text-sm font-medium text-text">{s.title}</span>
                <span className="text-xs text-muted">{s.purpose}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
