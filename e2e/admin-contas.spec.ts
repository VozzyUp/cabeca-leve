import { a11y, admin, createUser, expect, login, markOnboarded, noHorizontalScroll, openAdmin, PASSWORD, test, type TestUser } from "./fixtures";

// Contas e planos (/admin/contas): o time vê todas as contas, dá plano manual, estende o teste e exclui.
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

test("ADM-C1 o time acha a conta, dá plano manual até 2099, encerra, estende o teste, vê o registro e exclui @celular", async ({ page, user }) => {
  test.setTimeout(120_000);
  const owner = await adminUser();
  await login(page, owner, "/ajustes");
  // Configurações é só de quem usa o app: nada do time ali; o time entra por Administração, no menu da conta
  for (const name of [/Contas e planos/, /Custo da IA/, /Configuração do sistema/, /Chamados de suporte/]) await expect(page.getByRole("link", { name })).toHaveCount(0);
  await page.getByRole("button", { name: "Sua conta" }).click();
  await expect(page.locator("#menu-conta").getByText("Time", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await openAdmin(page);
  expect(await a11y(page)).toEqual([]);
  await expect(page.getByRole("link", { name: /Contas e planos/ })).toContainText(/\d+ contas?/);
  for (const name of [/Chamados de suporte/, /Custo da IA/, /Configuração do sistema/]) await expect(page.getByRole("link", { name })).toBeVisible();
  await page.getByRole("link", { name: /Contas e planos/ }).click();
  await expect(page.getByRole("heading", { name: "Contas e planos" })).toBeVisible();
  expect(await a11y(page)).toEqual([]);
  expect(await noHorizontalScroll(page)).toBe(true);

  // resumo e busca por e-mail
  await expect(page.getByRole("list", { name: "Resumo das contas" })).toContainText("Contas");
  await page.getByLabel("Buscar conta por nome ou e-mail").fill(user.email);
  const row = page.getByRole("list", { name: "Contas", exact: true }).getByRole("listitem");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Teste");
  await page.getByLabel("Buscar conta por nome ou e-mail").fill("");
  await page.getByRole("group", { name: "Filtrar por situação" }).getByRole("button", { name: /Em teste/ }).click();
  await expect(page.getByRole("link", { name: new RegExp(user.email) })).toBeVisible();

  // abre a conta
  await page.getByRole("link", { name: new RegExp(user.email) }).click();
  await expect(page.getByRole("heading", { name: user.name })).toBeVisible();
  await expect(page.getByText("Ninguém do time mexeu nesta conta ainda.")).toBeVisible();
  expect(await a11y(page)).toEqual([]);
  expect(await noHorizontalScroll(page)).toBe(true);

  // plano anual manual até 2099
  await page.getByLabel("Plano", { exact: true }).selectOption("yearly");
  await page.getByRole("button", { name: "Até 2099" }).click();
  await expect(page.getByLabel("Vale até", { exact: true })).toHaveValue("2099-12-31");
  await page.getByRole("button", { name: "Dar o plano" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Plano anual até 31/12/2099" })).toBeVisible();
  const { data: sub } = await admin.from("subscriptions").select("plan, status, current_period_end, provider_subscription_id").eq("user_id", user.id).single();
  expect(sub).toMatchObject({ plan: "yearly", status: "active", provider_subscription_id: `manual-${user.id}` });
  expect(sub!.current_period_end).toMatch(/^2099-12-31/);
  await expect(page.getByText("Plano manual anual até 31/12/2099")).toBeVisible();  // no registro
  await expect(page.getByRole("button", { name: "Salvar plano manual" })).toBeVisible();

  // a pessoa passa a ver o plano no app dela
  const own = await (await page.context().browser()!.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" })).newPage();
  try {
    await login(own, user, "/ajustes");
    await expect(own.getByText(/Plano anual/)).toBeVisible();
  } finally { await own.context().close(); }

  // data inválida é recusada com mensagem
  await page.getByLabel("Vale até", { exact: true }).fill("2020-01-01");
  await page.getByRole("button", { name: "Salvar plano manual" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /data de hoje até 31\/12\/2099/ })).toBeVisible();

  // encerrar o plano manual
  await page.getByRole("button", { name: "Encerrar plano manual" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Plano manual encerrado." })).toBeVisible();
  expect((await admin.from("subscriptions").select("status").eq("user_id", user.id).single()).data!.status).toBe("canceled");

  // teste: +30 dias
  await page.getByRole("button", { name: "+30 dias" }).last().click();
  await page.getByRole("button", { name: "Salvar teste" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Teste até / })).toBeVisible();
  const { data: profile } = await admin.from("profiles").select("trial_ends_on").eq("user_id", user.id).single();
  expect(profile!.trial_ends_on > new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10)).toBe(true);
  await expect(page.getByText("Plano manual encerrado", { exact: true })).toBeVisible();  // o registro lista tudo

  // excluir: só habilita com o e-mail certo
  await page.getByRole("button", { name: "Excluir esta conta" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Excluir para sempre" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("E-mail da conta").fill(user.email.toUpperCase());
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL("**/admin/contas");
  expect((await admin.auth.admin.getUserById(user.id)).data.user).toBeNull();
  const { data: log } = await admin.from("admin_actions").select("action").eq("target_user_id", user.id).order("id");
  expect(log!.map((a) => a.action)).toEqual(["plano manual", "plano manual encerrado", "teste", "conta excluída"]);
});

test("ADM-C2 quem não é do time não vê o atalho nem as telas de contas, e nada de outra conta aparece", async ({ page, user }) => {
  const other = await createUser("Outra");
  try {
    await login(page, user, "/ajustes");
    await expect(page.getByRole("link", { name: /Contas e planos/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Sua conta" }).click();
    await expect(page.locator("#menu-conta").getByRole("link", { name: "Administração" })).toHaveCount(0);
    await page.goto("/mais");
    await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administração" })).toHaveCount(0);
    await page.goto("/admin/contas");
    await expect(page.getByRole("heading", { name: "Contas e planos" })).toHaveCount(0);
    await expect(page.getByText(other.email)).toHaveCount(0);
    await page.goto(`/admin/contas/${other.id}`);
    await expect(page.getByRole("heading", { name: "Outra" })).toHaveCount(0);
    await expect(page.getByText(other.email)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dar o plano" })).toHaveCount(0);
    expect((await admin.from("subscriptions").select("id").eq("user_id", other.id)).data).toEqual([]);
  } finally { await admin.auth.admin.deleteUser(other.id); }
});
