import { DEFAULT_PLANS, planFromRow, sortPlans, type Plan } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdmin } from "@/lib/supabase/server";

// Catálogo de planos lido do banco (só no servidor). Sem banco (demonstração) ou sem a tabela, valem os planos de partida.
export async function loadPlans(): Promise<Plan[]> {
  if (!isSupabaseConfigured()) return DEFAULT_PLANS;
  const { data, error } = await getAdmin().from("plans").select("*");
  if (error || !data?.length) return DEFAULT_PLANS;
  return sortPlans(data.map((r) => planFromRow(r)));
}
