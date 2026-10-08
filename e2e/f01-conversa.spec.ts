import { a11y, admin, expect, login, test } from "./fixtures";

// F01: organizar várias coisas numa mensagem (o loop central)
test.describe("F01 conversa", () => {
  test.beforeEach(async ({ page, user }) => { await login(page, user); });

  const box = (page: import("@playwright/test").Page) => page.getByLabel("Mensagem para o assistente");

  test("F01-H1 gasto e lembrete numa frase viram dois cards e aparecem nas telas @celular", async ({ page }) => {
    await box(page).fill("gastei 35 na padaria e me lembra do mercado às 18h");
    await box(page).press("Enter");
    await expect(page.getByRole("article", { name: /Lançamento salvo: Padaria/ })).toBeVisible();
    await expect(page.getByRole("article", { name: /Lembrete salvo: Mercado/i })).toBeVisible();
    expect(await a11y(page)).toEqual([]);
    await page.getByRole("button", { name: "Ver no extrato" }).click();
    await page.waitForURL("**/dinheiro/extrato**");
    await expect(page.getByText("Padaria").first()).toBeVisible();
    await page.goto("/lembretes");
    await expect(page.getByText(/mercado/i).first()).toBeVisible();
  });

  test("F01-H2 desfazer pelo card tira o lançamento do extrato", async ({ page }) => {
    await box(page).fill("gastei 18 no estacionamento");
    await box(page).press("Enter");
    const card = page.getByRole("article", { name: /Lançamento salvo/ });
    await card.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByRole("article", { name: /Lançamento desfeito/ })).toBeVisible();
    await page.goto("/dinheiro/extrato");
    await expect(page.getByText(/estacionamento/i)).toHaveCount(0);
  });

  test("F01-E1 mensagem vazia ou só com espaços não envia", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Enviar", exact: true })).toHaveCount(0);
    await box(page).fill("    ");
    await expect(page.getByRole("button", { name: "Enviar", exact: true })).toHaveCount(0);
    await box(page).press("Enter");
    await expect(page.getByRole("log", { name: "Mensagens" }).getByText(/Esse eu ainda não sei fazer/)).toHaveCount(0);
  });

  test("F01-E2 o mesmo envio duas vezes (duplo clique, nova tentativa) grava uma vez", async ({ page, user }) => {
    await page.goto("/conversa");
    const body = JSON.stringify({ clientMessageId: crypto.randomUUID(), text: "gastei 50 no mercado" });
    const statuses = await page.evaluate(async (b) => {
      const go = () => fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: b }).then((r) => r.status);
      return Promise.all([go(), go()]);
    }, body);
    expect(statuses).toEqual([200, 200]);
    const { data } = await admin.from("transactions").select("id").eq("user_id", user.id);
    expect(data).toHaveLength(1);
  });

  test("F01-E3 acentos e emoji passam inteiros", async ({ page }) => {
    await box(page).fill("gastei 12,50 no café ☕ da Conceição");
    await box(page).press("Enter");
    await expect(page.getByRole("article", { name: /Lançamento salvo: Café ☕ da Conceição/i })).toBeVisible();
  });

  test("F01-E4 mensagem longa demais é recusada com explicação", async ({ page }) => {
    const r = await page.request.post("/api/chat", { data: { clientMessageId: "x", text: "a".repeat(4001) } });
    expect(r.status()).toBe(400);
    expect(await r.json()).toEqual({ error: "Mensagem longa demais" });
  });

  test("F01-E5 pedido que o assistente não entende recebe exemplos", async ({ page }) => {
    await box(page).fill("como você está?");
    await box(page).press("Enter");
    await expect(page.getByText(/Esse eu ainda não sei fazer/)).toBeVisible();
  });

  test("F01-E6 recarregar a página mantém a conversa", async ({ page }) => {
    await box(page).fill("cria uma tarefa de enviar o relatório até sexta");
    await box(page).press("Enter");
    await expect(page.getByRole("article", { name: /Tarefa salvo/ })).toBeVisible();
    await page.reload();
    await expect(page.getByText("cria uma tarefa de enviar o relatório até sexta")).toBeVisible();
    await expect(page.getByRole("article", { name: /Tarefa salvo/ })).toBeVisible();
  });

  test("F01-E7 sem internet: avisa, bloqueia o envio e não perde o texto", async ({ page, context }) => {
    await page.waitForLoadState("networkidle");
    await box(page).fill("gastei 9 no pão");
    await context.setOffline(true);
    await expect(box(page)).toBeDisabled();
    await expect(box(page)).toHaveAttribute("placeholder", "Sem conexão");
    await expect(box(page)).toHaveValue("gastei 9 no pão");
    await context.setOffline(false);
    await expect(box(page)).toBeEnabled();
    await box(page).press("Enter");
    await expect(page.getByRole("article", { name: /Lançamento salvo/ })).toBeVisible();
  });

  test("F01-N1 mais de 12 mensagens por minuto: o assistente pede para esperar e a mensagem não some", async ({ page }) => {
    // em paralelo: em sequência, com o dev server lento, as primeiras saíam da janela de 1 minuto
    await Promise.all(Array.from({ length: 12 }, (_, i) =>
      page.request.post("/api/chat", { data: { clientMessageId: crypto.randomUUID(), text: `oi ${i}` } })));
    await box(page).fill("gastei 7 no chiclete");
    await box(page).press("Enter");
    await expect(page.getByText(/Muitas mensagens em pouco tempo/)).toBeVisible();
    await expect(page.getByText("gastei 7 no chiclete")).toBeVisible();
  });
});
