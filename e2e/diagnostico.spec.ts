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
  test.setTimeout(90_000);
  // um aviso com o segredo errado: o sistema recusa e registra o motivo
  const refused = await request.post("/api/webhooks/whatsapp?secret=errado", { data: { token: "token-e2e", EventType: "messages" } });
  expect(refused.status()).toBe(401);
  await expect.poll(async () => (await admin.from("system_status").select("value").eq("key", "whatsapp_webhook").single()).data?.value).toMatchObject({ ok: false, result: expect.stringMatching(/Recusado/) });

  await login(page, await adminUser());
  await openAdmin(page);
  await page.getByRole("link", { name: /Configuração do sistema/ }).click();
  await expect(page.getByText("Diagnóstico do WhatsApp")).toBeVisible();
  await page.getByRole("button", { name: "Conferir agora" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /Último aviso que chegou do WhatsApp:/ })).toContainText("Recusado");
  await expect(page.getByRole("listitem").filter({ hasText: /Instância da UAZAPI: conectada/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /confere com este app/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /Número do assistente/ })).toContainText("5511900000000");

  // um aviso certo, mas que não é mensagem de pessoa: chega e é ignorado, e o painel diz isso
  const ok = await request.post("/api/webhooks/whatsapp?secret=segredo-e2e", { data: { token: "token-e2e", EventType: "presence" } });
  expect(ok.status()).toBe(200);
  await page.getByRole("button", { name: "Conferir agora" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /Último aviso que chegou do WhatsApp:/ })).toContainText("não era uma mensagem de pessoa");
});

test("DIA-2 quem não é do time não tem acesso ao diagnóstico", async ({ page, user }) => {
  await login(page, user, "/admin/configuracoes");
  await expect(page.getByText("Diagnóstico do WhatsApp")).toHaveCount(0);
});
