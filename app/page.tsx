import { redirect } from "next/navigation";

// Sem login ainda (chega no /replica-backend): a entrada do app é a conversa
export default function Home() {
  redirect("/conversa");
}
