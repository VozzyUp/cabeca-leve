import { admin, createUser, expect, login, mockCalls, PASSWORD, test } from "./fixtures";

// F15 assinar e entrar, F17 cancelar, F18 excluir, F19 personalizar, e a sessão
const mailpit = "http://127.0.0.1:54324/api/v1";
async function lastLinkTo(email: string, pattern: RegExp) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${mailpit}/search?query=${encodeURIComponent("to:" + email)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${mailpit}/message/${list.messages[0].ID}`)).json();
      const link = [...(msg.HTML || msg.Text).matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).find((l) => pattern.test(l));
      if (link) return link as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("e-mail não chegou para " + email);
}
const TOKEN = "token-do-webhook-e2e-com-mais-de-32-caracteres";
const asaas = (body: object, token = TOKEN) => fetch("http://localhost:3000/api/webhooks/asaas", {
  method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": token }, body: JSON.stringify(body),
});

test.describe("F15 entrar", () => {
  test("F15-H1 criar conta, confirmar pelo e-mail e cair no app", async ({ page }) => {
    const email = `cadastro-${Date.now()}@exemplo.com.br`;
    await page.goto("/entrar?modo=criar");
    await page.getByLabel("Seu nome").fill("Teste Cadastro");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Criar conta" }).last().click();
    await expect(page.getByText("Quase lá")).toBeVisible();
    await page.goto(await lastLinkTo(email, /verify/));
    await page.waitForURL("**/conversa");
    await page.goto("/ajustes");
    await expect(page.getByText(/Teste grátis até/)).toBeVisible();
    const { data } = await admin.auth.admin.listUsers();
    const id = data.users.find((u) => u.email === email)?.id;
    if (id) await admin.auth.admin.deleteUser(id);
  });

  test("F15-N1 senha errada explica sem dizer se o e-mail existe", async ({ page, user }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha").fill("senha-errada-999");
    await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test.describe("sessão expirada com a tela aberta", () => {
    // as chamadas em segundo plano recebem 401 depois que a sessão some: é o esperado
    test.use({ allowConsole: [/status of 401/] });

    test("F15-E3 ação numa tela aberta com a sessão vencida leva ao login e volta", async ({ page, context, user }) => {
      await login(page, user, "/tarefas");
      await context.clearCookies();
      await page.getByLabel("Nova tarefa").fill("Depois do login");
      await page.getByRole("button", { name: "Adicionar" }).click();
      await page.waitForURL(/\/entrar\?voltar=%2Ftarefas/);
      await page.getByLabel("E-mail").fill(user.email);
      await page.getByLabel("Senha").fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
      await page.waitForURL("**/tarefas");
    });
  });

  test("F15-E1 sessão expirada: tela volta para o login e depois para onde estava; API responde 401", async ({ browser, user }) => {
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();
    await login(page, user);
    await context.clearCookies();
    const api = await page.request.get("/api/tasks");
    expect(api.status()).toBe(401);
    await page.goto("/tarefas");
    await page.waitForURL(/\/entrar\?voltar=%2Ftarefas/);
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
    await page.waitForURL("**/tarefas");
    await context.close();
  });

  for (const evil of ["//evil.example/x", "/\\evil.example/x", "https://evil.example"]) {
    test(`F15-N2 voltar=${evil} não leva para fora do app`, async ({ page, user }) => {
      await page.goto(`/entrar?voltar=${encodeURIComponent(evil)}`);
      await page.getByLabel("E-mail").fill(user.email);
      await page.getByLabel("Senha").fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
      await page.waitForTimeout(2500);
      expect(new URL(page.url()).host).toBe("localhost:3000");
    });
  }
});

test.describe("F15 e F17 assinatura", () => {
  test("F15-H2 assinar, pagar e cancelar (F17-H1)", async ({ page, user }) => {
    // a página de pagamento é da Asaas: nada sai para fora, só confere o endereço
    let checkoutUrl = "";
    await page.route(/https:\/\/(sandbox\.)?asaas\.com\/.*/, (route) => { checkoutUrl = route.request().url(); return route.fulfill({ body: "checkout falso" }); });
    await login(page, user, "/planos");
    await page.getByRole("button", { name: "Assinar no cartão" }).click();
    await expect.poll(() => checkoutUrl).toMatch(/checkoutSession\/show\?id=chk_e2e_/);
    const checkoutId = new URL(checkoutUrl).searchParams.get("id")!;
    const sent = (await mockCalls()).filter((c) => c.url === "/v3/checkouts" && c.body.externalReference === user.id);
    expect(sent).toHaveLength(1);

    const run = `${Date.now()}`;
    const cus = `cus_${run}`, sub = `sub_${run}`;
    expect((await asaas({ id: `e1_${run}`, event: "CHECKOUT_PAID", checkout: { id: checkoutId, customer: cus } })).status).toBe(200);
    await asaas({ id: `e2_${run}`, event: "SUBSCRIPTION_CREATED", subscription: { id: sub, customer: cus } });
    await asaas({ id: `e3_${run}`, event: "PAYMENT_CONFIRMED", payment: { id: `pay_${run}`, customer: cus, subscription: sub, dueDate: new Date().toISOString().slice(0, 10) } });

    await page.unroute(/asaas\.com/);
    await page.goto("/ajustes");
    await expect(page.getByText(/Plano mensal · renova em/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar assinatura" }).click();
    await expect(page.getByText(/Plano mensal · vale até .*, sem renovar/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
    expect((await mockCalls()).some((c) => c.method === "DELETE" && c.url === `/v3/subscriptions/${sub}`)).toBe(true);
  });

  test("F15-N3 webhook da Asaas sem o token é recusado", async () => {
    expect((await asaas({ id: "x", event: "CHECKOUT_PAID" }, "errado")).status).toBe(401);
  });

  test("F15-E2 teste grátis acabou e sem plano: o assistente explica e manda para os planos", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user);
    const box = page.getByLabel("Mensagem para o assistente");
    await box.fill("gastei 10 no café");
    await box.press("Enter");
    await expect(page.getByText(/Seu teste grátis terminou/)).toBeVisible();
    const { data } = await admin.from("transactions").select("id").eq("user_id", user.id);
    expect(data).toEqual([]);
  });
});

test.describe("F18 e F19 conta", () => {
  test("F19-H1 tom e tema ficam salvos", async ({ page, user }) => {
    await login(page, user, "/ajustes/assistente");
    await page.getByRole("radiogroup", { name: "Tom da conversa" }).getByRole("radio", { name: "Divertido" }).click();
    await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Claro" }).click();
    await expect(page.getByText(/Salvo/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Divertido" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Claro" })).toBeChecked();
  });

  test.use({ allowConsole: [/status of 401/] });  // o outro aparelho recebe 401 depois da exclusão

  test("F18-H1 excluir a conta apaga tudo e sai; o outro aparelho também sai (F18-E1)", async ({ browser, page }) => {
    const u = await createUser("Apagar");
    const other = await (await browser.newContext({ locale: "pt-BR" })).newPage();
    await login(other, u, "/tarefas");
    await login(page, u, "/ajustes");
    await page.getByLabel('Digite "EXCLUIR" para confirmar').fill("excluir");
    await page.getByRole("button", { name: "Excluir tudo" }).click();
    await page.waitForURL("**/entrar?conta=excluida");
    const { data } = await admin.auth.admin.getUserById(u.id);
    expect(data.user).toBeNull();
    // o outro aparelho, com a sessão antiga, não pode ver erro de servidor
    // pode já ter ido sozinho para o login (401 em segundo plano); se não, navega
    const res = await other.goto("/tarefas").catch(() => null);
    if (res) expect(res.status()).toBeLessThan(500);
    await other.waitForURL(/\/entrar/);
    await other.context().close();
  });
});
