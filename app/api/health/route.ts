// GET /api/health: o Docker e o Portainer perguntam se o app está de pé
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
