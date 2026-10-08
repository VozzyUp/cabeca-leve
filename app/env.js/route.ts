import { serverPublicEnv } from "@/lib/public-env";

// GET /env.js: os valores públicos do ambiente para o navegador (nada secreto aqui)
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(`window.__ENV__=${JSON.stringify(serverPublicEnv())};`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}
