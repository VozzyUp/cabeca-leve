import { admin, createUser, expect, login, mockCalls, pay, PASSWORD, test } from "./fixtures";

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
    await page.goto(await lastLinkTo(email, /auth\/confirmar/));
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await page.waitForURL("**/conversa");
    await page.goto("/ajustes");
    await expect(page.getByText(/Teste grátis até/)).toBeVisible();
    const { data } = await admin.auth.admin.listUsers();
    const id = data.users.find((u) => u.email === email)?.id;
    if (id) await admin.auth.admin.deleteUser(id);
  });

  test("F15-H1b o link do e-mail abre em outro navegador e só gasta no toque do botão", async ({ page, browser }) => {
    const email = `outro-${Date.now()}@exemplo.com.br`;
    await page.goto("/entrar?modo=criar");
    await page.getByLabel("Seu nome").fill("Teste Outro Navegador");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Criar conta" }).last().click();
    await expect(page.getByText("Quase lá")).toBeVisible();
    const link = await lastLinkTo(email, /auth\/confirmar/);
    // um leitor de links só faz GET: não pode gastar o link
    await fetch(link);
    await fetch(link.replace("/auth/confirmar", "/auth/confirm"));
    // aparelho novo, sem o cookie de quem se cadastrou
    const other = await browser.newContext();
    const tab = await other.newPage();
    await tab.goto(link);
    await tab.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await tab.waitForURL("**/conversa");
    // gastou: de novo, link inválido com opção de reenviar
    const again = await browser.newContext();
    const tab2 = await again.newPage();
    await tab2.goto(link);
    await tab2.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await tab2.waitForURL(/link=invalido/);
    await expect(tab2.getByText("Esse link expirou ou já foi usado.")).toBeVisible();
    await expect(tab2.getByRole("button", { name: "Reenviar o e-mail de confirmação" })).toBeVisible();
    await other.close(); await again.close();
    const { data } = await admin.auth.admin.listUsers();
    const id = data.users.find((u) => u.email === email)?.id;
    if (id) await admin.auth.admin.deleteUser(id);
  });

  test("F15-H3 esqueci a senha: o link do e-mail leva à senha nova", async ({ page, user }) => {
    await page.goto("/entrar?modo=senha");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByRole("button", { name: "Mandar o link" }).click();
    await expect(page.getByText(/mandamos um link para criar uma senha nova/)).toBeVisible();
    await page.goto(await lastLinkTo(user.email, /auth\/confirmar/));
    await page.getByRole("button", { name: "Criar uma senha nova" }).click();
    await page.waitForURL("**/entrar/nova-senha");
    await page.getByLabel("Senha nova").fill("outra-senha-forte-123");
    await page.getByRole("button", { name: "Salvar a senha" }).click();
    await page.waitForURL("**/conversa");
  });

  test("F15-N0 link sem código vai para a tela de entrar com aviso", async ({ page }) => {
    await page.goto("/auth/confirmar?token_hash=curto&type=email");
    await expect(page).toHaveURL(/link=invalido/);
    await expect(page.getByRole("button", { name: "Reenviar o e-mail de confirmação" })).toBeVisible();
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
    // a tela aberta também recebe 401 e manda para o login sozinha (lib/api.ts): sai dela antes, sem corrida
    await page.goto("about:blank");
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
  test("F15-H2 assinar no cartão pela tela do app e cancelar (F17-H1)", async ({ page, user }) => {
    await login(page, user, "/planos");
    await page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mensal" }) }).getByRole("link", { name: "Assinar" }).click();
    await expect(page).toHaveURL(/\/assinar\/monthly$/);
    const sub = await pay(page, user, "monthly", "Cartão de crédito");
    await expect(page.getByRole("heading", { name: "Pagamento aprovado" })).toBeVisible();
    const sent = (await mockCalls()).filter((c) => c.url === "/v3/subscriptions" && c.body.externalReference === user.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ billingType: "CREDIT_CARD", cycle: "MONTHLY", value: 39.9 });

    const run = `${Date.now()}`;
    const cus = `cus_${run}`;
    await asaas({ id: `e3_${run}`, event: "PAYMENT_CONFIRMED", payment: { id: `pay_${run}`, customer: cus, subscription: sub, dueDate: new Date().toISOString().slice(0, 10) } });

    await page.goto("/ajustes");
    await expect(page.getByText(/Plano mensal · renova em/)).toBeVisible();
    await page.getByRole("link", { name: /Meu plano/ }).click();
    await page.getByRole("button", { name: "Cancelar assinatura" }).click();
    await expect(page.getByRole("note").filter({ hasText: "Assinatura cancelada em" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
    await page.goto("/ajustes");
    await expect(page.getByText(/Plano mensal · vale até .*, sem renovar/)).toBeVisible();
    expect((await mockCalls()).some((c) => c.method === "DELETE" && c.url === `/v3/subscriptions/${sub}`)).toBe(true);
  });

  test("F15-N3 webhook da Asaas sem o token é recusado", async () => {
    expect((await asaas({ id: "x", event: "PAYMENT_RECEIVED" }, "errado")).status).toBe(401);
  });

  test("F15-E2 teste grátis acabou e sem plano: o app bloqueia, explica e manda para os planos", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user);
    await expect(page).toHaveURL(/\/ajustes\/plano\?expirou=1/);
    await expect(page.getByRole("alert").filter({ hasText: "Seu teste grátis terminou" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Escolha um plano" })).toBeVisible();
    const { data } = await admin.from("transactions").select("id").eq("user_id", user.id);
    expect(data).toEqual([]);
  });
});

test.describe("F18 e F19 conta", () => {
  test("F19-H1 tom e tema ficam salvos", async ({ page, user }) => {
    await login(page, user, "/ajustes/assistente");
    await page.getByRole("group", { name: "Tom da conversa" }).getByRole("radio", { name: /^Divertido/ }).click();
    await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Claro" }).click();
    // a tela não pode desfazer a primeira mudança ao fazer a segunda
    await expect(page.getByRole("radio", { name: /^Divertido/ })).toBeChecked();
    // espera as duas gravações (o "Salvo" aparece já depois da primeira)
    await expect.poll(async () => (await admin.from("profiles").select("assistant_tone, theme").eq("user_id", user.id).single()).data)
      .toEqual({ assistant_tone: "playful", theme: "light" });
    await page.reload();
    await expect(page.getByRole("radio", { name: /^Divertido/ })).toBeChecked();
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
