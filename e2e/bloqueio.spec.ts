import { a11y, admin, expect, login, noHorizontalScroll, test } from "./fixtures";

// Teste grátis acabou e sem assinatura: nada do app abre. Só a conta e a cobrança, para assinar, pedir ajuda e levar os dados.
const expire = (userId: string) => admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", userId);

test.describe("Sem plano: tudo bloqueado", () => {
  test("BLQ-1 qualquer tela do app leva para Meu plano com o aviso, e o menu some @celular", async ({ page, user }) => {
    await expire(user.id);
    await login(page, user);  // entrou: já cai na tela do plano, não na conversa
    await expect(page).toHaveURL(/\/ajustes\/plano\?expirou=1/);
    await expect(page.getByRole("heading", { level: 1, name: "Meu plano" })).toBeVisible();
    const alert = page.getByRole("alert").filter({ hasText: "Seu teste grátis terminou" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Tudo o que você anotou continua guardado");
    await expect(page.getByRole("link", { name: "Falar com uma pessoa" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Escolha um plano" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Assinar no cartão \(plano mensal\)/ })).toBeVisible();

    // sem menu do app: nem lateral, nem barra de baixo, nem avisos
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Avisos/ })).toHaveCount(0);
    expect(await a11y(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);

    // digitar o endereço de qualquer tela volta para cá
    for (const path of ["/conversa", "/tarefas", "/dinheiro", "/dia", "/lembretes", "/documentos", "/cofre", "/saude", "/avisos", "/mais", "/ajustes/assistente", "/briefing"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/ajustes\/plano\?expirou=1/);
    }
  });

  test("BLQ-2 as rotas de dados respondem 402 e nada é gravado", async ({ page, user }) => {
    await expire(user.id);
    await login(page, user);
    const get = await page.request.get("/api/tasks");
    expect(get.status()).toBe(402);
    expect(await get.json()).toMatchObject({ code: "plan_expired", error: expect.stringMatching(/teste terminou/) });
    const post = await page.request.post("/api/tasks", { data: { title: "não deve gravar", dueOn: null } });
    expect(post.status()).toBe(402);
    expect((await admin.from("tasks").select("id").eq("user_id", user.id)).data).toEqual([]);
    expect((await page.request.get("/api/day")).status()).toBe(402);
    // a conta e a cobrança seguem abertas
    expect((await page.request.get("/api/billing/status")).status()).toBe(200);
  });

  test("BLQ-3 Configurações, suporte, planos e termos seguem abertos; pedir uma pessoa funciona", async ({ page, user }) => {
    await expire(user.id);
    await login(page, user);
    await page.goto("/ajustes");
    await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
    await expect(page).toHaveURL(/\/ajustes$/);
    await page.goto("/ajustes/suporte");
    await page.getByLabel("O que aconteceu?").fill("Meu teste acabou e quero entender os planos.");
    await page.getByRole("button", { name: "Chamar uma pessoa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Chamado aberto" })).toBeVisible();
    expect((await admin.from("support_tickets").select("status").eq("user_id", user.id)).data).toEqual([{ status: "open" }]);
    for (const path of ["/planos", "/privacidade", "/termos"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });

  test("BLQ-4 assinou: libera na hora, sem sair e entrar de novo", async ({ page, user }) => {
    await expire(user.id);
    await login(page, user);
    await expect(page).toHaveURL(/\/ajustes\/plano/);
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "asaas", provider_customer_id: "c", provider_subscription_id: `sub_blq_${Date.now()}`, plan: "monthly", status: "active", current_period_end: new Date(Date.now() + 25 * 86_400_000).toISOString(), cancel_at_period_end: false });
    await page.goto("/conversa", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/conversa$/);
    await expect(page.getByLabel("Mensagem para o assistente")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Seu teste grátis terminou" })).toHaveCount(0);
    expect((await page.request.get("/api/tasks")).status()).toBe(200);
  });

  test("BLQ-5 no teste, ainda dentro do prazo, nada é bloqueado", async ({ page, user }) => {
    await login(page, user, "/tarefas");
    await expect(page).toHaveURL(/\/tarefas$/);
    expect((await page.request.get("/api/tasks")).status()).toBe(200);
  });
});
