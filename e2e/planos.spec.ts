import type { Page } from "@playwright/test";
import { a11y, admin, expect, login, markOnboarded, mockCalls, noHorizontalScroll, openAdmin, PASSWORD, test, type TestUser } from "./fixtures";

// Planos: o time cria, edita e tira da venda (/admin/planos); quem usa vê o próprio plano, o uso e troca de plano (/ajustes/plano).
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

// a página de pagamento é da Asaas: nada sai para fora, só confere o endereço
async function captureCheckout(page: Page) {
  let url = "";
  await page.route(/https:\/\/(sandbox\.)?asaas\.com\/.*/, (r) => { url = r.request().url(); return r.fulfill({ body: "checkout falso" }); });
  return () => url;
}

test.describe("Administração: planos e limites", () => {
  test("PLN-A1 o time cria um plano, edita valor e limites, tira da venda e exclui; a página de planos acompanha @celular", async ({ page }) => {
    test.setTimeout(150_000);
    const name = `Família e2e ${Date.now()}`;
    const owner = await adminUser();
    try {
      await login(page, owner);
      await openAdmin(page);
      await page.getByRole("link", { name: /Planos e limites/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Planos e limites" })).toBeVisible();
      const list = page.getByRole("list", { name: "Planos" });
      for (const base of ["Mensal", "Anual", "Teste grátis"]) await expect(list.getByRole("heading", { name: base, exact: true })).toBeVisible();
      await expect(list.getByRole("listitem").filter({ hasText: "Mensal" }).first()).toContainText(/R\$\s*39,90/);
      expect(await a11y(page)).toEqual([]);
      expect(await noHorizontalScroll(page)).toBe(true);

      // o teste grátis só tem limites: nada de preço
      await page.getByRole("button", { name: "Editar Teste grátis" }).click();
      const trial = page.getByRole("dialog", { name: "Limites do teste grátis" });
      await expect(trial.getByLabel("Mensagens por dia")).toBeVisible();
      await expect(trial.getByLabel("Preço (R$)")).toHaveCount(0);
      await trial.getByRole("button", { name: "Cancelar" }).click();

      // criar
      await page.getByRole("button", { name: "Novo plano" }).click();
      const dialog = page.getByRole("dialog", { name: "Novo plano" });
      await dialog.getByLabel("Nome", { exact: true }).fill(name);
      await dialog.getByLabel("Preço (R$)").fill("59,90");
      await dialog.getByLabel("Duração").selectOption("3");
      await dialog.getByLabel("WhatsApps na conta").fill("6");
      await dialog.getByLabel("Mensagens por dia").fill("500");
      await dialog.getByLabel("Espaço para documentos (MB)").fill("4096");
      expect(await a11y(page)).toEqual([]);
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByRole("status").filter({ hasText: `Plano ${name} criado` })).toBeVisible();
      const card = list.getByRole("listitem").filter({ hasText: name });
      await expect(card).toContainText(/R\$\s*59,90/);
      await expect(card).toContainText("a cada 3 meses");
      await expect(card).toContainText("À venda");
      await expect(card).toContainText("Nenhuma assinatura ainda.");

      // a página de planos já mostra o plano novo, com os limites
      await page.goto("/planos", { waitUntil: "networkidle" });
      const pub = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(pub).toContainText(/R\$\s*59,90/);
      await expect(pub).toContainText("até 6 números de WhatsApp");
      await expect(pub).toContainText("500 mensagens por dia");
      await expect(pub).toContainText("4 GB para documentos");
      await expect(pub.getByRole("button", { name: "Assinar no cartão" })).toBeVisible();

      // editar: preço e limite
      await page.goto("/admin/planos", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: `Editar ${name}` }).click();
      const edit = page.getByRole("dialog", { name: `Editar ${name}` });
      await edit.getByLabel("Preço (R$)").fill("49,90");
      await edit.getByLabel("Mensagens por dia").fill("600");
      await edit.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Alterações salvas" })).toBeVisible();
      await expect(card).toContainText(/R\$\s*49,90/);
      await expect(card).toContainText("600 mensagens por dia");
      await expect(page.getByText(new RegExp(`Plano ${name}: preço: R\\$ 59,90 → R\\$ 49,90`))).toBeVisible();

      // dados inválidos voltam como mensagem, sem fechar a janela
      await page.getByRole("button", { name: `Editar ${name}` }).click();
      await page.getByRole("dialog", { name: `Editar ${name}` }).getByLabel("Preço (R$)").fill("grátis");
      await page.getByRole("dialog", { name: `Editar ${name}` }).getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /Confira o preço/ })).toBeVisible();
      await page.getByRole("dialog", { name: `Editar ${name}` }).getByRole("button", { name: "Cancelar" }).click();

      // tirar da venda: some da página de planos e fica marcado no painel
      await page.getByRole("button", { name: `Editar ${name}` }).click();
      const off = page.getByRole("dialog", { name: `Editar ${name}` });
      await off.getByLabel("À venda").uncheck();
      await off.getByRole("button", { name: "Salvar" }).click();
      await expect(card).toContainText("Fora de venda");
      await page.goto("/planos", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);

      // excluir (nunca teve assinatura)
      await page.goto("/admin/planos", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: `Editar ${name}` }).click();
      await page.getByRole("dialog", { name: `Editar ${name}` }).getByRole("button", { name: "Excluir plano" }).click();
      await page.getByRole("dialog", { name: "Excluir o plano" }).getByRole("button", { name: "Excluir para sempre" }).click();
      await expect(page.getByRole("status").filter({ hasText: `Plano ${name} excluído` })).toBeVisible();
      await expect(list.getByRole("heading", { name, exact: true })).toHaveCount(0);
      await expect(page.getByText(`Excluiu o plano ${name}`)).toBeVisible();
    } finally {
      await admin.from("plans").delete().like("name", "Família e2e %");
    }
  });

  test("PLN-A2 plano com assinatura não se exclui e não muda de duração; o plano manual usa o catálogo", async ({ page, user }) => {
    test.setTimeout(120_000);
    const name = `Pro e2e ${Date.now()}`;
    const owner = await adminUser();
    const id = `pro-e2e-${Date.now()}`;
    try {
      await admin.from("plans").insert({ id, name, kind: "paid", price_cents: 7990, months: 1, recurring: true, whatsapp_limit: 4, messages_per_day: 900, storage_mb: 3000, sort: 800 });
      await login(page, owner, "/admin/contas");
      await page.getByLabel("Buscar conta por nome ou e-mail").fill(user.email);
      await page.getByRole("link", { name: new RegExp(user.email) }).click();
      await expect(page.getByRole("heading", { name: user.name })).toBeVisible();
      await page.getByLabel("Plano", { exact: true }).selectOption(id);
      await page.getByRole("button", { name: "Dar o plano" }).click();
      await expect(page.getByText(new RegExp(`Plano ${name.toLowerCase()} até`))).toBeVisible();
      const { data: sub } = await admin.from("subscriptions").select("plan, status").eq("user_id", user.id).single();
      expect(sub).toMatchObject({ plan: id, status: "active" });

      await page.goto("/admin/planos", { waitUntil: "networkidle" });
      const card = page.getByRole("list", { name: "Planos" }).getByRole("listitem").filter({ hasText: name });
      await expect(card).toContainText("1 assinatura valendo");
      await page.getByRole("button", { name: `Editar ${name}` }).click();
      const dialog = page.getByRole("dialog", { name: `Editar ${name}` });
      await expect(dialog.getByLabel("Duração")).toBeDisabled();
      await expect(dialog.getByLabel("Cobrança")).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Excluir plano" })).toHaveCount(0);
      await dialog.getByLabel("Mensagens por dia").fill("1200");
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(card).toContainText("1.200 mensagens por dia");

      // quem tem o plano vê o limite novo em Meu plano
      await page.getByRole("button", { name: "Sua conta" }).click();
      await page.getByRole("button", { name: "Sair" }).click();
      await login(page, user, "/ajustes/plano");
      await expect(page.getByRole("heading", { level: 2, name: `Plano ${name.toLowerCase()}` })).toBeVisible();
      await expect(page.getByRole("progressbar", { name: "Mensagens hoje" })).toBeVisible();
      await expect(page.getByText("de 1.200", { exact: false }).first()).toBeVisible();
    } finally {
      await admin.from("subscriptions").delete().eq("user_id", user.id);
      await admin.from("plans").delete().eq("id", id);
    }
  });

  test("PLN-A3 quem não é do time não vê a tela de planos", async ({ page, user }) => {
    await login(page, user, "/admin/planos");
    await expect(page.getByRole("heading", { name: "Planos e limites" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo plano" })).toHaveCount(0);
  });
});

test.describe("Meu plano", () => {
  test("PLN-U1 no teste: mostra até quando vale, o uso e os planos para assinar @celular", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    await expect(page.getByRole("heading", { level: 1, name: "Meu plano" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Teste grátis" })).toBeVisible();
    await expect(page.getByText("O teste vai até")).toBeVisible();
    await expect(page.getByText(/faltam \d+ dias|falta 1 dia|termina hoje/)).toBeVisible();
    for (const meter of ["Mensagens hoje", "WhatsApps vinculados", "Espaço para documentos"]) await expect(page.getByRole("progressbar", { name: meter })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Mensagens hoje" })).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("heading", { level: 2, name: "Escolha um plano" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Assinar no cartão \(plano mensal\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pagar o ano.*\(plano anual\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);

    // assinar abre a página de pagamento do plano escolhido
    const url = await captureCheckout(page);
    await page.getByRole("button", { name: /Pagar o ano.*\(plano anual\)/ }).click();
    await expect.poll(url).toMatch(/checkoutSession\/show\?id=chk_e2e_/);
    const sent = (await mockCalls()).filter((c) => c.url === "/v3/checkouts" && c.body.externalReference === user.id);
    expect(sent.at(-1)!.body).toMatchObject({ chargeTypes: ["DETACHED"], items: [{ value: 359 }] });
  });

  test("PLN-U5 a Asaas recusa o checkout: a pessoa vê o aviso (não uma tela quebrada) e o time vê o motivo", async ({ page, user }) => {
    test.setTimeout(90_000);
    const name = `Falha e2e ${Date.now()}`;
    try {
      await admin.from("plans").insert({ id: `falha-e2e-${Date.now()}`, name, kind: "paid", price_cents: 666, months: 1, recurring: true, whatsapp_limit: 2, messages_per_day: 200, storage_mb: 2048, sort: 900 });
      await login(page, user, "/ajustes/plano");
      await page.getByRole("button", { name: new RegExp(`Assinar no cartão \\(plano ${name.toLowerCase()}\\)`) }).click();
      await expect(page).toHaveURL(/\/ajustes\/plano\?erro=pagamento/);
      await expect(page.getByRole("alert").filter({ hasText: "Não deu para abrir a página de pagamento" })).toBeVisible();
      await expect(page.getByText("Não deu para carregar esta tela")).toHaveCount(0);
      expect(await a11y(page)).toEqual([]);
      await expect(async () => {
        const { data } = await admin.from("system_status").select("value").eq("key", "asaas_checkout").single();
        expect(data?.value).toMatchObject({ ok: false });
        expect(JSON.stringify(data?.value)).toContain("Checkout recusado no teste");
      }).toPass({ timeout: 10_000 });
    } finally {
      await admin.from("plans").delete().like("name", "Falha e2e %");
    }
  });

  test("PLN-U2 teste vencido: avisa que acabou e oferece os planos", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user, "/ajustes/plano");
    await expect(page.getByRole("progressbar")).toHaveCount(0);  // sem plano não há o que medir
    await expect(page.getByRole("alert").filter({ hasText: "Seu teste grátis terminou" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Escolha um plano" })).toBeVisible();
  });

  test("PLN-U3 com plano: mostra valor, renovação, upgrade e cancelamento @celular", async ({ page, user }) => {
    test.setTimeout(90_000);
    const sub = `sub_e2e_${Date.now()}`;
    const end = new Date(Date.now() + 20 * 86_400_000).toISOString();
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "asaas", provider_customer_id: "cus_e2e", provider_subscription_id: sub, plan: "monthly", status: "active", current_period_end: end, cancel_at_period_end: false });
    await login(page, user, "/ajustes");
    await expect(page.getByRole("link", { name: /Meu plano/ })).toContainText(/Plano mensal · renova em/);
    await page.getByRole("link", { name: /Meu plano/ }).click();
    await expect(page).toHaveURL(/\/ajustes\/plano$/);
    await expect(page.getByRole("heading", { level: 2, name: "Plano mensal" })).toBeVisible();
    await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
    await expect(page.getByText(/R\$\s*39,90/).first()).toBeVisible();
    await expect(page.getByText("Próxima renovação")).toBeVisible();
    await expect(page.getByText(/faltam (19|20|21) dias/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Mudar de plano" })).toBeVisible();
    const mine = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Mensal" }) });
    await expect(mine).toContainText("Seu plano");
    await expect(mine.getByRole("button")).toHaveCount(0);
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);

    // upgrade abre o pagamento do plano anual
    const url = await captureCheckout(page);
    await page.getByRole("button", { name: /Fazer upgrade \(plano anual\)/ }).click();
    await expect.poll(url).toMatch(/checkoutSession/);
    await page.waitForURL(/asaas\.com/);  // a navegação para a página de pagamento termina antes de seguir
    await page.unroute(/asaas\.com/);
    expect((await mockCalls()).filter((c) => c.url === "/v3/checkouts" && c.body.externalReference === user.id).at(-1)!.body).toMatchObject({ chargeTypes: ["DETACHED"], items: [{ value: 359 }] });

    // cancelar: comprovante e o status muda
    await page.goto("/ajustes/plano", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cancelar assinatura" }).click();
    await expect(page.getByRole("note").filter({ hasText: "Assinatura cancelada em" })).toContainText(/CL-[A-Z2-9]{6}/);
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
  });

  test("PLN-U4 plano pago em pagamento único: diz que não renova", async ({ page, user }) => {
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "asaas", provider_customer_id: "cus_e2e", provider_subscription_id: `checkout:e2e_${Date.now()}`, plan: "yearly", status: "active", current_period_end: new Date(Date.now() + 300 * 86_400_000).toISOString(), cancel_at_period_end: true });
    await login(page, user, "/ajustes/plano");
    await expect(page.getByRole("heading", { level: 2, name: "Plano anual" })).toBeVisible();
    await expect(page.getByText("Vale até")).toBeVisible();
    await expect(page.getByText(/pagamento único: não renova sozinho/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toHaveCount(0);
  });
});
