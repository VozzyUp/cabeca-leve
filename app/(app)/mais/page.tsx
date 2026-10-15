import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ADMIN_HOME, MORE_GROUPS } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";

// Celular: tudo que não cabe na barra inferior, em grupos
export default async function MorePage() {
  const isTeam = isSupabaseConfigured() && isSupportAdmin((await currentUser())?.email);
  const groups = isTeam ? [...MORE_GROUPS, { title: "Time", items: [ADMIN_HOME] }] : MORE_GROUPS;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold leading-[34px]">Tudo</h1>
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`g-${g.title}`} className="flex flex-col gap-2">
          <h2 id={`g-${g.title}`} className="text-label text-muted">{g.title}</h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {g.items.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-text">{s.label}</span>
                    {s.hint && <span className="text-xs text-muted">{s.hint}</span>}
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
