import { Client, Receiver } from "@upstash/qstash";
import { after } from "next/server";
import { siteUrl } from "@/lib/public-env";

// Fila de trabalho: com QStash, entrega com novas tentativas (e o webhook responde na hora).
// Sem QStash (desenvolvimento), roda logo depois de responder, no mesmo processo.
const site = siteUrl;

export async function enqueue(path: string, body: unknown, run: () => Promise<void>) {
  if (process.env.QSTASH_TOKEN) {
    await new Client({ token: process.env.QSTASH_TOKEN }).publishJSON({ url: `${site()}${path}`, body, retries: 3 });
  } else {
    after(() => run().catch((e) => console.error(`fila ${path}`, e)));
  }
}

// Confere a assinatura do QStash nas rotas /api/jobs/*
export async function verifyQStash(request: Request, rawBody: string) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY, next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return false;
  const signature = request.headers.get("upstash-signature") ?? "";
  return new Receiver({ currentSigningKey: current, nextSigningKey: next }).verify({ signature, body: rawBody }).catch(() => false);
}
