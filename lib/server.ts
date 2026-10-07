import { connection } from "next/server";
import { getStore } from "@/lib/data";
import { localDate } from "@/lib/time";

// Para telas renderizadas no servidor: marca a rota como dinâmica (os dados mudam a cada
// pedido) e devolve o banco, o fuso e o dia local de hoje.
export async function serverContext() {
  await connection();
  const store = getStore();
  const now = new Date();
  const tz = store.timezone();
  return { store, now, tz, today: localDate(now, tz) };
}
