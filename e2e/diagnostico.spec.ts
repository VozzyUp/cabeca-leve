import { admin, expect, login, mockCalls, openAdmin, PASSWORD, postWebhook, test, markOnboarded, type TestUser } from "./fixtures";

// Diagnóstico do WhatsApp (Administração > Configuração do sistema): mostra o último sinal do webhook e o que a ZapCoder diz.
const ADMIN = "config-e2e@exemplo.com.br";  // está em ADMIN_EMAILS (playwright.config.ts)
async function adminUser(): Promise<TestUser> {
  // os testes deste arquivo rodam em paralelo: quem perde a corrida de criar a conta só relê a que o outro criou
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const old = data.users.find((u) => u.email === ADMIN);
    if (old) return { id: old.id, email: ADMIN, name: "Dono" };
    const { data: created, error } = await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true, user_metadata: { name: "Dono" } });
    if (!error) {
      await markOnboarded(created.user!.id);
      return { id: created.user!.id, email: ADMIN, name: "Dono" };
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error("não consegui criar a conta de admin do teste");
}

test("DIA-1 o painel mostra o aviso recusado do webhook e a instância conectada com o webhook certo", async ({ page }) => {
  test.setTimeout(120_000);
  const last = page.getByRole("listitem").filter({ hasText: /Último aviso que chegou do WhatsApp:/ });
  await login(page, await adminUser());
  await openAdmin(page);
  await page.getByRole("link", { name: /Configuração do sistema/ }).click();
  await expect(page.getByText("Diagnóstico do WhatsApp")).toBeVisible();

  // o painel mostra o ÚLTIMO sinal de todo o sistema; outros testes mandam avisos ao mesmo tempo, então repete até ver o seu
  await expect(async () => {
    // um aviso com a assinatura errada: o sistema recusa e registra o motivo
    expect((await postWebhook({ EventType: "messages" }, { secret: "segredo-errado-com-mais-de-16-caracteres" })).status).toBe(401);
    await page.getByRole("button", { name: "Conferir agora" }).click();
    await expect(last).toContainText("Recusado", { timeout: 4000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("listitem").filter({ hasText: /Instância da ZapCoder: conectada/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /confere com este app/ })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /Número do assistente/ })).toContainText("5511900000000");

  // um aviso certo, mas que não é mensagem de pessoa: chega e é ignorado, e o painel diz isso
  await expect(async () => {
    expect((await postWebhook({ EventType: "presence" })).status).toBe(200);
    await page.getByRole("button", { name: "Conferir agora" }).click();
    await expect(last).toContainText("não era uma mensagem de pessoa", { timeout: 4000 });
  }).toPass({ timeout: 60_000 });
});

test("DIA-3 o admin cadastra o webhook na ZapCoder pelo painel, com a URL do app, o segredo e só mensagens recebidas", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, await adminUser());
  await openAdmin(page);
  await page.getByRole("link", { name: /Configuração do sistema/ }).click();
  await page.getByRole("button", { name: "Conferir agora" }).click();
  await page.getByRole("button", { name: "Cadastrar webhook na ZapCoder" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /Webhook cadastrado na ZapCoder\. Mande uma mensagem/ })).toBeVisible();
  const sent = (await mockCalls()).filter((c) => c.method === "POST" && c.url === "/webhook").at(-1)!.body;
  expect(sent).toMatchObject({ url: "http://localhost:3000/api/webhooks/whatsapp", events: ["messages"], excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"], secret: "segredo-e2e-do-webhook-com-mais-de-16" });
});

test("DIA-2 quem não é do time não tem acesso ao diagnóstico", async ({ page, user }) => {
  await login(page, user, "/admin/configuracoes");
  await expect(page.getByText("Diagnóstico do WhatsApp")).toHaveCount(0);
});
