import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStore, UnauthorizedError } from "@/lib/data";
import { localDate } from "@/lib/time";

// Para telas renderizadas no servidor: marca a rota como dinâmica (os dados mudam a cada
// pedido) e devolve o banco do usuário, o fuso e o dia local de hoje. Sem sessão, vai ao login.
export async function serverContext() {
  await connection();
  const store = await getStore().catch((e) => {
    if (e instanceof UnauthorizedError) redirect("/entrar");
    throw e;
  });
  const now = new Date();
  const tz = store.timezone();
  return { store, now, tz, today: localDate(now, tz) };
}
