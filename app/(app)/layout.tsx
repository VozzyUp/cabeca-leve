import { Suspense } from "react";
import { RealtimeSync } from "@/components/realtime-sync";
import { Onboarding } from "@/components/screens/onboarding";
import { ReminderWatcher } from "@/components/screens/reminder-watcher";
import { BottomNav, NavRail } from "@/components/ui/nav";
import { ThemeSync } from "@/components/ui/theme-sync";
import { TopBar } from "@/components/ui/top-bar";
import { serverContext } from "@/lib/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

// Layout das telas logadas: menu lateral no computador, barra inferior no celular e,
// nos dois, a barra de cima com voltar, avisos, tema e a conta (com Sair)
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { store } = await serverContext();
  const [settings, notices] = await Promise.all([store.getSettings(), store.listNotices()]);
  const unread = notices.filter((n) => !n.readAt).length;
  const configured = isSupabaseConfigured();
  const user = configured ? await currentUser() : null;
  return (
    <div className="flex flex-1">
      <ThemeSync theme={settings.theme} />
      {user && <RealtimeSync userId={user.id} />}
      <div className="hidden lg:block"><NavRail /></div>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-28 lg:px-8 lg:pb-10">
        <TopBar unread={unread} name={settings.name} email={settings.email} theme={settings.theme} canSignOut={configured} />
        {children}
      </main>
      <div className="fixed inset-x-4 bottom-4 z-10 lg:hidden"><BottomNav /></div>
      <ReminderWatcher serverDelivery={configured} />
      {configured && <Suspense><Onboarding initial={settings} /></Suspense>}
    </div>
  );
}
