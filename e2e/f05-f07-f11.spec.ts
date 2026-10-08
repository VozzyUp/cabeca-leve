import type { Page } from "@playwright/test";
import { admin, expect, login, test } from "./fixtures";

const say = async (page: Page, text: string) => {
  const box = page.getByLabel("Mensagem para o assistente");
  await box.fill(text);
  await box.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText(/Pronto, tirei da sua cabeça|Esse eu ainda não sei fazer/).last()).toBeVisible();
};
const metric = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");

test.describe("F05 dinheiro", () => {
  test("F05-H1 entrada e gasto pela conversa fecham a conta do mês @celular", async ({ page, user }) => {
    await login(page, user);
    await say(page, "recebi 3000 de salário");
    await say(page, "gastei 120 no mercado no pix");
    await page.goto("/dinheiro", { waitUntil: "networkidle" });
    await expect(metric(page, "Entrou")).toHaveText("R$ 3.000,00");
    await expect(metric(page, "Saiu")).toHaveText("R$ 120,00");
    await expect(metric(page, "Sobra do mês")).toHaveText("R$ 2.880,00");
    await expect(metric(page, "Saldo em conta")).toHaveText("R$ 2.880,00");
    await expect(page.getByRole("button", { name: "Próximo mês" })).toBeDisabled();
    await page.getByRole("button", { name: "Mês anterior" }).click();
    await expect(page.getByText("Nenhum gasto neste mês")).toBeVisible();
  });

  test("F05-E1 compra no crédito não tira do saldo da conta", async ({ page, user }) => {
    await admin.from("cards").insert({ user_id: user.id, name: "Nubank", limit_cents: 500000, closing_day: 3, due_day: 10 });
    await login(page, user);
    await say(page, "recebi 1000 de freela");
    await say(page, "gastei 200 no cartão de crédito na farmácia");
    await page.goto("/dinheiro", { waitUntil: "networkidle" });
    await expect(metric(page, "Saiu")).toHaveText("R$ 200,00");
    await expect(metric(page, "Saldo em conta")).toHaveText("R$ 1.000,00");
  });

  test("F05-E2 filtro do extrato por tipo", async ({ page, user }) => {
    await login(page, user);
    await say(page, "recebi 500 de freela");
    await say(page, "gastei 40 no cinema");
    await page.goto("/dinheiro/extrato", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: "Entrou" }).click();
    const list = page.getByRole("main").locator("section");
    await expect(list.getByText(/cinema/i)).toHaveCount(0);
    await expect(list.getByText("+R$ 500,00").first()).toBeVisible();
  });
});

test.describe("F07 hábitos", () => {
  test("F07-H1 criar pela conversa e marcar hoje: sequência 1", async ({ page, user }) => {
    await login(page, user);
    await say(page, "quero meditar todo dia às 7h");
    await page.goto("/habitos", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Meditar" })).toBeVisible();
    await page.getByRole("button", { name: "Marcar hoje" }).click();
    await expect(page.getByRole("button", { name: "Feito" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByText(/Sequência\s*1/)).toBeVisible();
    // desmarcar volta a zero
    await page.getByRole("button", { name: "Feito" }).click();
    await expect(page.getByRole("button", { name: "Marcar hoje" })).toBeVisible();
  });

  test("F07-E1 hábito só em alguns dias mostra folga nos outros", async ({ page, user }) => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
    const other = (today + 3) % 7;
    await admin.from("habits").insert({ user_id: user.id, name: "Natação", weekdays: [other] });
    await login(page, user, "/habitos");
    await expect(page.getByText("folga hoje")).toBeVisible();
  });
});

test.describe("F11 notas", () => {
  test("F11-H1 guardar e reencontrar pela busca", async ({ page, user }) => {
    await login(page, user, "/notas");
    await page.getByLabel("Título").fill("Viagem para Ouro Preto");
    await page.getByLabel("Texto").fill("Pousada perto da praça Tiradentes, levar casaco.");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Viagem para Ouro Preto")).toBeVisible();
    await page.getByLabel("Buscar nas notas").fill("tiradentes");
    await expect(page.getByText("Viagem para Ouro Preto")).toBeVisible();
    await page.getByLabel("Buscar nas notas").fill("praia");
    await expect(page.getByText("Nada encontrado para “praia”")).toBeVisible();
  });

  test("F11-E1 nota vazia não salva", async ({ page, user }) => {
    await login(page, user, "/notas");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /título|texto|escreva/i })).toBeVisible();
    await expect(page.getByText("Nenhuma nota aqui")).toBeVisible();
  });
});
