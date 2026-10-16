import { a11y, admin, CARD, expect, fillPayment, lastAttempt, login, mockCalls, noHorizontalScroll, pay, test } from "./fixtures";

// Pagamento dentro do app: Pix, boleto e cartão pela API da Asaas, sem abrir a página dela. O webhook confirma.
const TOKEN = "token-do-webhook-e2e-com-mais-de-32-caracteres";
const asaasEvent = (body: object) => fetch("http://localhost:3000/api/webhooks/asaas", {
  method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": TOKEN }, body: JSON.stringify(body),
});

test.describe("Pagamento no app", () => {
  test("PAG-1 escolher a forma, ver as opções do plano e voltar @celular", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    await page.getByRole("link", { name: /Assinar \(plano mensal\)/ }).click();
    await expect(page).toHaveURL(/\/assinar\/monthly$/);
    await expect(page.getByRole("heading", { level: 1, name: "Assinar o plano mensal" })).toBeVisible();
    await expect(page.getByText(/R\$\s*39,90/).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Como você quer pagar?" })).toBeVisible();
    // plano que renova: só o cartão renova; Pix e boleto pagam um período
    await expect(page.getByRole("radio", { name: /^Cartão de crédito.*Renova por mês/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Pix.*sem renovação automática/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Boleto.*Vence em 3 dias/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("radio", { name: /^Pix/ }).check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Seus dados para o Pix" })).toBeVisible();
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("button", { name: "Escolher outra forma de pagar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Como você quer pagar?" })).toBeVisible();
    // nenhuma página da Asaas aparece no caminho
    expect(page.url()).not.toMatch(/asaas/);
  });

  test("PAG-2 Pix: mostra o QR e o copia e cola, e quando o webhook confirma a tela avisa que foi aprovado @celular", async ({ page, user }) => {
    test.setTimeout(90_000);
    await login(page, user, "/ajustes/plano");
    const id = await pay(page, user, "yearly", "Pix");
    await expect(page.getByRole("heading", { name: "Pague com Pix" })).toBeVisible();
    await expect(page.getByAltText("QR code do Pix")).toBeVisible();
    await expect(page.getByText(/^00020126580014br\.gov\.bcb\.pix/)).toBeVisible();
    await expect(page.getByText(/Aguardando o pagamento do Pix/)).toBeVisible();
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    const sent = (await mockCalls()).filter((c) => c.url === "/v3/payments" && c.body.externalReference === user.id).at(-1)!.body;
    expect(sent).toMatchObject({ billingType: "PIX", value: 359 });
    expect(sent.creditCard).toBeUndefined();

    // o banco confirma: o webhook libera o plano e a tela, que está perguntando, mostra a aprovação
    expect((await asaasEvent({ id: `pix_${id}`, event: "PAYMENT_RECEIVED", payment: { id, customer: "cus_e2e" } })).status).toBe(200);
    await expect(page.getByRole("heading", { name: "Pagamento aprovado" })).toBeVisible({ timeout: 20_000 });
    await page.goto("/ajustes/plano");
    await expect(page.getByRole("heading", { level: 2, name: "Plano anual" })).toBeVisible();
    await expect(page.getByText("Vale até")).toBeVisible();
  });

  test("PAG-3 boleto: mostra a linha digitável e o vencimento", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    await pay(page, user, "monthly", "Boleto");
    await expect(page.getByRole("heading", { name: "Boleto gerado" })).toBeVisible();
    await expect(page.getByText("23793.38128 60000.000003")).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar o boleto (PDF)" })).toHaveAttribute("href", "https://example.com/boleto.pdf");
    await expect(page.getByText(/Vence em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    expect((await mockCalls()).filter((c) => c.url === "/v3/payments" && c.body.externalReference === user.id).at(-1)!.body).toMatchObject({ billingType: "BOLETO", value: 39.9 });
  });

  test("PAG-4 cartão aprovado: libera na hora e o dado do cartão não fica guardado", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    const id = await pay(page, user, "monthly", "Cartão de crédito");
    await expect(page.getByRole("heading", { name: "Pagamento aprovado" })).toBeVisible();
    await expect(page.getByText(/Você pode cancelar quando quiser em Meu plano/)).toBeVisible();
    expect(await a11y(page)).toEqual([]);
    const sent = (await mockCalls()).filter((c) => c.url === "/v3/subscriptions" && c.body.externalReference === user.id).at(-1)!.body as Record<string, Record<string, string>>;
    expect(sent.creditCard).toMatchObject({ number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" });
    expect(sent.creditCardHolderInfo).toMatchObject({ cpfCnpj: "52998224725", postalCode: "01310100", addressNumber: "100" });
    const { data } = await admin.from("checkout_sessions").select("*").eq("user_id", user.id);
    expect(JSON.stringify(data)).not.toContain("4111");
    expect(await lastAttempt(user.id)).toMatchObject({ id, status: "paid", method: "card", kind: "subscription" });
    await page.goto("/ajustes/plano");
    await expect(page.getByRole("heading", { level: 2, name: "Plano mensal" })).toBeVisible();
    await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
  });

  test("PAG-5 cartão recusado: mostra o motivo, mantém os dados e deixa tentar de novo", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    await page.goto("/assinar/monthly", { waitUntil: "networkidle" });
    await fillPayment(page, "Cartão de crédito", { card: CARD.refused });
    const alert = page.getByRole("alert").filter({ hasText: "Transação não autorizada" });
    await expect(alert).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toHaveValue("Maria da Silva");   // não perde o que digitou
    expect(await a11y(page)).toEqual([]);
    expect(await lastAttempt(user.id)).toMatchObject({ status: "failed", failure: expect.stringContaining("Transação não autorizada") });
    // nada liberado e o time vê o motivo
    expect((await admin.from("subscriptions").select("id").eq("user_id", user.id)).data).toEqual([]);
    // corrige o cartão e passa
    await page.getByLabel("Número do cartão").fill(CARD.number);
    await page.getByRole("button", { name: /Pagar com cartão/ }).click();
    await expect(page.getByRole("heading", { name: "Pagamento aprovado" })).toBeVisible();
  });

  test("PAG-6 dados inválidos são explicados antes de enviar", async ({ page, user }) => {
    await login(page, user, "/ajustes/plano");
    await page.goto("/assinar/monthly", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: /^Cartão de crédito/ }).check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("CPF ou CNPJ").fill("111.111.111-11");
    await page.getByLabel("Número do cartão").fill("4111 1111 1111 1112");
    await page.getByLabel("Validade (MM/AA)").fill("01/20");
    await page.getByRole("button", { name: /Pagar com cartão/ }).click();
    await expect(page.getByText("CPF ou CNPJ inválido.")).toBeVisible();
    await expect(page.getByText("Número do cartão inválido.")).toBeVisible();
    await expect(page.getByText("Validade inválida ou vencida.")).toBeVisible();
    await expect(page.getByText("Celular inválido. Use o DDD.")).toBeVisible();
    expect(await a11y(page)).toEqual([]);
    expect((await mockCalls()).some((c) => c.url === "/v3/payments" || c.url === "/v3/subscriptions" ? c.body.externalReference === user.id : false)).toBe(false);
  });

  test("PAG-7 a Asaas recusa a cobrança: a tela mostra o motivo; plano fora de venda volta para a lista", async ({ page, user }) => {
    test.setTimeout(90_000);
    const id = `recusa-e2e-${Date.now()}`;
    try {
      await admin.from("plans").insert({ id, name: `Recusa e2e ${Date.now()}`, kind: "paid", price_cents: 666, months: 1, recurring: false, whatsapp_limit: 2, messages_per_day: 200, storage_mb: 2048, sort: 900 });
      await login(page, user, "/ajustes/plano");
      await page.goto(`/assinar/${id}`, { waitUntil: "networkidle" });
      await fillPayment(page, "Pix");
      await expect(page.getByRole("alert").filter({ hasText: "Cobrança recusada no teste" })).toBeVisible();
      await expect(async () => {
        const { data } = await admin.from("system_status").select("value").eq("key", "asaas_checkout").single();
        expect(data?.value).toMatchObject({ ok: false });
      }).toPass({ timeout: 10_000 });
      await admin.from("plans").update({ active: false }).eq("id", id);
      await page.goto(`/assinar/${id}`);
      await expect(page).toHaveURL(/\/planos\?indisponivel=1/);
    } finally {
      await admin.from("checkout_sessions").delete().eq("plan", id);
      await admin.from("plans").delete().eq("id", id);
    }
  });

  test("PAG-8 sem plano (teste acabou): a tela de pagamento abre mesmo com o resto do app trancado", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user, "/ajustes/plano");
    await page.getByRole("link", { name: /Assinar \(plano mensal\)/ }).click();
    await expect(page).toHaveURL(/\/assinar\/monthly$/);
    await expect(page.getByRole("heading", { level: 2, name: "Como você quer pagar?" })).toBeVisible();
    await pay(page, user, "monthly", "Cartão de crédito");
    await expect(page.getByRole("heading", { name: "Pagamento aprovado" })).toBeVisible();
    // pagou: o app abre
    await page.goto("/conversa");
    await expect(page).toHaveURL(/\/conversa/);
  });

  test("PAG-9 sem estar logado, a tela de pagamento pede o login", async ({ page }) => {
    await page.goto("/assinar/monthly");
    await expect(page).toHaveURL(/\/entrar/);
  });
});
