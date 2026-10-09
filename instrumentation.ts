// Roda uma vez quando o servidor sobe: carrega a configuração do banco (tela de admin) e
// relê a cada 30 s, para outras réplicas verem as mudanças.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { loadAppConfig } = await import("@/lib/app-config");
  await loadAppConfig(true);
  setInterval(() => { loadAppConfig().catch(() => {}); }, 30_000).unref();
}
