import { admin, expect, login, mockCalls, PASSWORD, test, type TestUser } from "./fixtures";

// Tela de configuração do sistema (/admin/configuracoes): as chaves dos serviços no banco,
// criptografadas, valendo na hora. Usa campos que os outros testes não leem (rodam em paralelo).
const ADMIN = "dono-e2e@exemplo.com.br";
async function adminUser(): Promise<TestUser> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const old = data.users.find((u) => u.email === ADMIN);
  if (old) return { id: old.id, email: ADMIN, name: "Dono" };
  const { data: created, error } = await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true, user_metadata: { name: "Dono" } });
  if (error) throw error;
  return { id: created.user!.id, email: ADMIN, name: "Dono" };
}

test.describe.configure({ mode: "serial" });

test("ADM-H1 o dono salva chaves pela tela; segredo não volta inteiro; vale na hora; apagar volta ao stack", async ({ page, user }) => {
  const owner = await adminUser();
  await admin.from("app_settings").delete().in("key", ["EMAIL_FROM", "ASAAS_API_KEY", "META_WEBHOOK_VERIFY_TOKEN"]);
  await login(page, owner, "/ajustes");
  await page.getByRole("link", { name: /Configuração do sistema/ }).click();
  await expect(page.getByRole("heading", { name: "Configuração do sistema" })).toBeVisible();

  // texto comum: troca o remetente dos e-mails
  const email = page.locator("form").filter({ hasText: "E-mail (Resend)" });
  await email.getByLabel("Remetente").fill("Teste Admin <admin@exemplo.com.br>");
  await email.getByRole("button", { name: /^Salvar/ }).click();
  await expect(email.getByRole("status")).toHaveText("Salvo. Já está valendo.");
  await page.reload();
  await expect(page.locator("form").filter({ hasText: "E-mail (Resend)" }).getByText("salvo aqui: Teste Admin <admin@exemplo.com.br>")).toBeVisible();

  // segredo: só os 4 últimos caracteres voltam para a tela, e no banco fica criptografado
  const asaas = page.locator("form").filter({ hasText: "Cobrança (Asaas)" });
  await asaas.getByLabel("Chave da API").fill("$aact_chave_super_secreta_9876");
  await asaas.getByRole("button", { name: /^Salvar/ }).click();
  await expect(asaas.getByRole("status")).toBeVisible();
  await page.reload();
  await expect(page.getByText("salvo aqui: ••••9876")).toBeVisible();
  expect(await page.content()).not.toContain("chave_super_secreta");
  const { data: row } = await admin.from("app_settings").select("value_encrypted").eq("key", "ASAAS_API_KEY").single();
  expect(row!.value_encrypted).toMatch(/^v1:/);
  expect(row!.value_encrypted).not.toContain("secreta");

  // gerar token e ver o endereço para colar no serviço
  const wa = page.locator("form").filter({ hasText: "Meta: token de verificação do webhook" });
  await wa.locator("div").filter({ hasText: /^Meta: token de verificação do webhook/ }).getByRole("button", { name: "Gerar" }).click();
  await expect(wa.getByRole("status")).toHaveText("Gerado e salvo.");
  await page.getByRole("button", { name: "Mostrar" }).click();
  await expect(page.getByText(/^[0-9a-f]{48}$/)).toBeVisible();

  // vale na hora: o próximo e-mail sai com o remetente novo
  const p2 = await (await page.context().browser()!.newContext({ locale: "pt-BR" })).newPage();
  await login(p2, user, "/ajustes/suporte");
  await p2.getByLabel("O que aconteceu?").fill("Teste do remetente configurado pela tela.");
  await p2.getByRole("button", { name: "Chamar uma pessoa" }).click();
  await expect(p2.getByRole("status").filter({ hasText: "Chamado aberto" })).toBeVisible();
  await expect.poll(async () => (await mockCalls()).filter((c) => c.url === "/emails").map((c) => c.body.from)).toContain("Teste Admin <admin@exemplo.com.br>");
  await p2.context().close();

  // apagar volta ao valor do stack
  await page.locator("form").filter({ hasText: "E-mail (Resend)" }).getByRole("button", { name: "Apagar" }).click();
  await expect(page.locator("form").filter({ hasText: "E-mail (Resend)" }).getByText(/vem do stack: Cabeça Leve <oi@exemplo.com.br>/)).toBeVisible();
  await admin.from("app_settings").delete().in("key", ["ASAAS_API_KEY", "META_WEBHOOK_VERIFY_TOKEN"]);
});

test("ADM-H2 o dono escolhe o modelo e o nível do assistente; sem escolha vale o padrão", async ({ page }) => {
  const owner = await adminUser();
  await admin.from("app_settings").delete().in("key", ["ANTHROPIC_MODEL", "ANTHROPIC_EFFORT"]);
  await login(page, owner, "/admin/configuracoes");
  const form = () => page.locator("form").filter({ hasText: "Assistente (Anthropic)" });
  // sem escolha: mostra o padrão (Sonnet 5.5, médio)
  await expect(form().getByLabel("Modelo")).toContainText("usar o padrão (Sonnet 5.5)");
  await expect(form().getByLabel("Nível de raciocínio")).toContainText("usar o padrão (Médio)");
  // a lista tem os três modelos e os cinco níveis
  await expect(form().getByLabel("Modelo").locator("option")).toHaveCount(4);
  await expect(form().getByLabel("Nível de raciocínio").locator("option")).toHaveCount(6);

  await form().getByLabel("Modelo").selectOption("claude-haiku-5-5");
  await form().getByLabel("Nível de raciocínio").selectOption("high");
  await form().getByRole("button", { name: /^Salvar/ }).click();
  await expect(form().getByRole("status")).toHaveText("Salvo. Já está valendo.");
  await page.reload();
  await expect(form().getByText("salvo aqui: claude-haiku-5-5")).toBeVisible();
  await expect(form().getByText("salvo aqui: high")).toBeVisible();

  // apagar volta ao padrão
  await form().locator("div").filter({ hasText: /^Modelo/ }).getByRole("button", { name: "Apagar" }).click();
  await expect(form().getByLabel("Modelo")).toContainText("usar o padrão (Sonnet 5.5)");
  await admin.from("app_settings").delete().in("key", ["ANTHROPIC_MODEL", "ANTHROPIC_EFFORT"]);
});

test("ADM-N1 quem não é admin não vê a tela nem o atalho, e não consegue salvar", async ({ page, user }) => {
  await login(page, user, "/ajustes");
  await expect(page.getByRole("link", { name: /Configuração do sistema/ })).toHaveCount(0);
  await page.goto("/admin/configuracoes");
  await expect(page.getByRole("heading", { name: "Configuração do sistema" })).toHaveCount(0);
  const { count } = await admin.from("app_settings").select("key", { count: "exact", head: true });
  expect(count).toBe(0);
});
