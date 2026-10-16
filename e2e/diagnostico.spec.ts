import { admin, expect, login, openAdmin, PASSWORD, test, markOnboarded, type TestUser } from "./fixtures";

// Diagnóstico do WhatsApp (Administração > Configuração do sistema): mostra o último sinal do webhook e o que a UAZAPI diz.
const ADMIN = "config-e2e@exemplo.com.br";  // está em ADMIN_EMAILS (playwright.config.ts)
async function adminUser(): Promise<TestUser> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const old = data.users.find((u) => u.email === ADMIN);
  if (old) return { id: old.id, email: ADMIN, name: "Dono" };
  const { data: created, error } = await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true, user_metadata: { name: "Dono" } });
  if (error) throw error;
  await markOnboarded(created.user!.id);
  return { id: created.user!.id, email: ADMIN, name: "Dono" };
}

test("DIA-1 o painel mostra o aviso recusado do webhook e a instância conectada com o webhook certo", async ({ page, request }) => {
  test.setTimeout(120_000);
  const last = page.getByRole("listitem").filter({ hasText: /Último aviso que chegou do WhatsApp:/ });
  await login(page, await adminUser());
  await openAdmin(page);
  await page.getByRole("link", { name: /Configuração do sistema/ }).click();
  await expect(page.getByText("Diagnóstico do WhatsApp")).toBeVisible();

  // o painel mostra o ÚLTIMO sinal de todo o sistema; outros testes mandam avisos ao mesmo tempo, então repete até ver o seu
  await expect(async () => {
    // um aviso com o segredo errado: o sistema recusa e registra o motivo
    expect((await request.post("/api/webhooks/whatsapp?secret=errado", { data: { token: "token-e2e", EventType: "messages" } })).status()).toBe(401);
    await page.getByRole("button", { name: "Conferir agora" }).click();
    await expect(last).toContainText("Recusado", { timeout: 4000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("listitem").filter({ hasText: /Instância da UAZAPI: conectada/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /confere com este app/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /Número do assistente/ })).toContainText("5511900000000");

  // um aviso certo, mas que não é mensagem de pessoa: chega e é ignorado, e o painel diz isso
  await expect(async () => {
    expect((await request.post("/api/webhooks/whatsapp?secret=segredo-e2e", { data: { token: "token-e2e", EventType: "presence" } })).status()).toBe(200);
    await page.getByRole("button", { name: "Conferir agora" }).click();
    await expect(last).toContainText("não era uma mensagem de pessoa", { timeout: 4000 });
  }).toPass({ timeout: 60_000 });
});

test("DIA-2 quem não é do time não tem acesso ao diagnóstico", async ({ page, user }) => {
  await login(page, user, "/admin/configuracoes");
  await expect(page.getByText("Diagnóstico do WhatsApp")).toHaveCount(0);
});
