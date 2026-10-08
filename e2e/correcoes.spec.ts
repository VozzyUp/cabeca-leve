import type { Page } from "@playwright/test";
import { a11y, admin, expect, login, mockCalls, test } from "./fixtures";

// F5, F6 e F7 do replica/fixes.md
const say = async (page: Page, text: string) => {
  const box = page.getByLabel("Mensagem para o assistente");
  await box.fill(text);
  await box.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
};

test.describe("F5 teto de gastos", () => {
  test("F5-H1 teto pela tela; gasto que passa de 80% e de 100% avisa no card, em Avisos e na barra", async ({ page, user }) => {
    await login(page, user, "/dinheiro");
    await page.getByLabel("Categoria").selectOption({ label: "Alimentação" });
    await page.getByLabel("Teto por mês (R$)").fill("100");
    await page.getByRole("button", { name: "Definir teto" }).click();
    const bar = page.getByRole("progressbar", { name: "Teto de Alimentação" });
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(await a11y(page)).toEqual([]);

    await page.goto("/conversa", { waitUntil: "networkidle" });
    await say(page, "gastei 85 no almoço");
    await expect(page.getByText(/Alimentação: R\$\s85,00 de R\$\s100,00 \(85% do teto\)\. Faltam R\$\s15,00\./)).toBeVisible();
    await say(page, "gastei 20 no lanche");
    await expect(page.getByText(/Passou do teto de Alimentação: R\$\s105,00 de R\$\s100,00 \(105%\)/)).toBeVisible();
    await say(page, "gastei 5 no café");  // já passou: não repete o aviso
    await expect(page.getByText(/Passou do teto de Alimentação/)).toHaveCount(1);

    await page.goto("/avisos");
    await expect(page.getByText("Perto do teto: Alimentação")).toBeVisible();
    await expect(page.getByText("Teto estourado: Alimentação")).toBeVisible();
    await page.goto("/dinheiro", { waitUntil: "networkidle" });
    await expect(bar).toHaveAttribute("aria-valuetext", "110%, passou do teto");
    await expect(page.getByText("110% · passou R$ 10,00")).toBeVisible();
    await page.getByRole("button", { name: "Tirar teto de Alimentação" }).click();
    await expect(bar).toHaveCount(0);
  });

  test("F5-H2 teto pela conversa, também por apelido da categoria; categoria que não existe explica", async ({ page, user }) => {
    await login(page, user);
    await say(page, "teto de 300 no transporte");
    await expect(page.getByText("Pronto: teto de R$ 300,00 por mês em Transporte. Aviso quando passar de 80% e de 100%.")).toBeVisible();
    await say(page, "coloca um teto de 400 no ifood");
    await expect(page.getByText("Pronto: teto de R$ 400,00 por mês em Alimentação. Aviso quando passar de 80% e de 100%.")).toBeVisible();
    await say(page, "teto de 50 em astronomia");
    await expect(page.getByText(/Não achei a categoria “astronomia”/)).toBeVisible();
    const { data } = await admin.from("budgets").select("amount_cents").eq("user_id", user.id).order("amount_cents");
    expect(data!.map((b) => b.amount_cents)).toEqual([30000, 40000]);
  });

  test("F5-N1 teto em categoria de outra conta ou de entrada é recusado", async ({ page, user }) => {
    await login(page, user);
    const { data: income } = await admin.from("categories").select("id").eq("user_id", user.id).eq("kind", "income").limit(1).single();
    expect((await page.request.post("/api/budgets", { data: { categoryId: income!.id, amountCents: 1000 } })).status()).toBe(404);
    expect((await page.request.post("/api/budgets", { data: { categoryId: "00000000-0000-4000-8000-000000000000", amountCents: 1000 } })).status()).toBe(404);
    expect((await page.request.post("/api/budgets", { data: { categoryId: income!.id, amountCents: -5 } })).status()).toBe(400);
  });
});

test.describe("F6 testar aviso", () => {
  test("F6-H1 testar mostra o resultado de cada canal e manda pelo WhatsApp vinculado", async ({ page, user }) => {
    const number = `55119${String(Date.now()).slice(-8)}`;
    await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: `+${number}`, verified_at: new Date().toISOString() });
    await login(page, user, "/ajustes");
    await page.getByRole("button", { name: "Testar", exact: true }).click();
    const status = page.getByRole("status").filter({ hasText: "WhatsApp:" });
    await expect(status).toContainText(`Mensagem enviada para +${number} no WhatsApp.`);
    await expect(status).toContainText("Notificações no aparelho ainda não estão ligadas neste app.");  // sem chaves VAPID no teste
    expect((await mockCalls()).some((c) => c.url === "/send/text" && c.body.number === number && /Aviso de teste/.test(String(c.body.text)))).toBe(true);
    await page.goto("/avisos");
    await expect(page.getByText("Aviso de teste")).toBeVisible();
  });

  test("F6-E1 sem WhatsApp vinculado, diz como resolver", async ({ page, user }) => {
    await login(page, user, "/ajustes");
    await page.getByRole("button", { name: "Testar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp:" })).toContainText("WhatsApp não vinculado");
  });
});

test.describe("F7 seu WhatsApp fica intacto", () => {
  test("F7-H1 a promessa aparece no cadastro, nos Ajustes e nas dúvidas dos planos", async ({ page, user }) => {
    const promise = "Nunca pedimos acesso ao seu WhatsApp, e o assistente nunca escreve para os seus contatos.";
    await page.goto("/entrar?modo=criar");
    await expect(page.getByText(promise)).toBeVisible();
    await page.goto("/planos");
    await page.getByText("Vocês acessam o meu WhatsApp?").click();
    await expect(page.getByText(promise)).toBeVisible();
    await login(page, user, "/ajustes");
    await expect(page.getByText(promise)).toBeVisible();
  });
});
