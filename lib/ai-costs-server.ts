import { getAdmin } from "@/lib/supabase/server";
import { periodRange, summarize, type PeriodId, type UsageRow, type UserInfo } from "./ai-costs";

// Lê os totais do período (função admin_ai_usage) e os nomes e e-mails de quem usou. Só o servidor, com a chave secreta.
export async function loadCosts(period: PeriodId, now = new Date()) {
  const db = getAdmin();
  const { from, to } = periodRange(period, now);
  const { data, error } = await db.rpc("admin_ai_usage", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as UsageRow[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const users = new Map<string, UserInfo>();
  if (ids.length) {
    const { data: profiles } = await db.from("profiles").select("user_id, display_name").in("user_id", ids);
    for (const p of profiles ?? []) users.set(p.user_id, { name: p.display_name, email: null });
    for (let page = 1; page <= 20; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of list?.users ?? []) if (users.has(u.id)) users.get(u.id)!.email = u.email ?? null;
      if ((list?.users.length ?? 0) < 1000) break;
    }
  }
  return { summary: summarize(rows, users), from, to };
}
