import { Suspense } from "react";
import { PushKeeper } from "@/components/push-keeper";
import { RealtimeSync } from "@/components/realtime-sync";
import { Onboarding } from "@/components/screens/onboarding";
import { ReminderWatcher } from "@/components/screens/reminder-watcher";
import { BottomNav, NavRail } from "@/components/ui/nav";
import { ThemeSync } from "@/components/ui/theme-sync";
import { TopBar } from "@/components/ui/top-bar";
import { serverContext } from "@/lib/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";

// Layout das telas logadas: menu lateral no computador, barra inferior no celular e,
// nos dois, a barra de cima com voltar, avisos, tema e a conta (com Sair)
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { store } = await serverContext({ allowLocked: true });  // quem decide o que abre é cada tela (e o proxy); aqui só muda a moldura
  const [settings, notices] = await Promise.all([store.getSettings(), store.listNotices()]);
  const unread = notices.filter((n) => !n.readAt).length;
  const configured = isSupabaseConfigured();
  const user = configured ? await currentUser() : null;
  const isTeam = isSupportAdmin(user?.email);
  // sem plano: moldura mínima, só a conta (nada de menu, avisos, lembretes ou conversa)
  const locked = configured && settings.plan === "none" && !isTeam;
  return (
    <div className="flex flex-1">
      <ThemeSync theme={settings.theme} />
      {user && !locked && <RealtimeSync userId={user.id} />}
      {!locked && <div className="hidden lg:block"><NavRail isTeam={isTeam} /></div>}
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
        <TopBar unread={unread} name={settings.name} email={settings.email} theme={settings.theme} canSignOut={configured} isTeam={isTeam} locked={locked} />
        {children}
      </main>
      {!locked && <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 lg:hidden"><BottomNav /></div>}
      {!locked && <ReminderWatcher serverDelivery={configured} />}
      {configured && !locked && <PushKeeper enabled={settings.channels.push} />}
      {configured && !locked && <Suspense><Onboarding initial={settings} /></Suspense>}
    </div>
  );
}
