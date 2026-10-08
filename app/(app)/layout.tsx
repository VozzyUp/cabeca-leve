import { RealtimeSync } from "@/components/realtime-sync";
import { ReminderWatcher } from "@/components/screens/reminder-watcher";
import { BottomNav, NavRail } from "@/components/ui/nav";
import { ThemeSync } from "@/components/ui/theme-sync";
import { serverContext } from "@/lib/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

// Layout das telas logadas: trilho lateral no computador, barra inferior no celular
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { store } = await serverContext();
  const [settings, notices] = await Promise.all([store.getSettings(), store.listNotices()]);
  const unread = notices.filter((n) => !n.readAt).length;
  const user = isSupabaseConfigured() ? await currentUser() : null;
  return (
    <div className="flex flex-1">
      <ThemeSync theme={settings.theme} />
      {user && <RealtimeSync userId={user.id} />}
      <div className="hidden lg:block"><NavRail notifications={unread} /></div>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{children}</main>
      <div className="fixed inset-x-4 bottom-4 z-10 lg:hidden"><BottomNav /></div>
      <ReminderWatcher serverDelivery={isSupabaseConfigured()} />
    </div>
  );
}
