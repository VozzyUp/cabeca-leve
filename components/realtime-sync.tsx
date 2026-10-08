"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { browserClient } from "@/lib/supabase/browser";

const TABLES = ["tasks", "reminders", "transactions", "habits", "habit_logs", "messages", "notices", "notes", "journal_entries", "goals",
  "goal_entries", "projects", "milestones", "recurrences", "categories", "food_logs", "workout_logs", "body_measurements",
  "focus_sessions", "automations", "channel_links", "subscriptions", "profiles"] as const;

export const DATA_CHANGED = "app:data-changed";

// Ouve as mudanças da pessoa (outro aparelho, WhatsApp, lembrete que tocou) e atualiza a tela
// aberta: as telas do servidor com router.refresh, as do navegador pelo evento DATA_CHANGED.
export function RealtimeSync({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const changed = () => {
      // várias mudanças juntas (ex.: o assistente salvou três itens) viram uma atualização só
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { window.dispatchEvent(new Event(DATA_CHANGED)); router.refresh(); }, 400);
    };
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    // o Realtime precisa do token da sessão ANTES de inscrever; sem ele entra como anônimo e o RLS esconde tudo
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel(`dados-${userId}`);
      for (const table of TABLES) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, changed);
      }
      channel.subscribe();
    });
    // token renovado: o Realtime continua autorizado
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) void supabase.realtime.setAuth(session.access_token); });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      sub.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, router]);
  return null;
}
