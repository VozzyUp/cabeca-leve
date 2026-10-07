import { SignIn } from "@/components/screens/sign-in";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Chegada pelo link de "esqueci a senha": a sessão de recuperação já está nos cookies
export default function Page() {
  return (
    <div className="flex flex-1 items-start justify-center pt-8">
      <SignIn initialMode="newPassword" notice={null} demo={!isSupabaseConfigured()} next="/conversa" plan={null} />
    </div>
  );
}
