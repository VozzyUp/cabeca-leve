import { a11y, admin, expect, login, test } from "./fixtures";

// F21: "A resolver" no Dinheiro: contas fixas e entradas esperadas que venceram sem lançamento
test.describe("F21 a resolver", () => {
  test("F21-H1 mostra a conta e a entrada em aberto, confirmar lança no extrato e tira da lista", async ({ page, user }) => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const anchor = `${now.toISOString().slice(0, 7)}-01`;
    const row = (kind: "bill" | "income", description: string, amount_cents: number) =>
      ({ user_id: user.id, kind, description, amount_cents, frequency: "monthly", interval_count: 1, anchor_on: anchor, payment_method: "pix", created_at: monthStart });
    const { error } = await admin.from("recurrences").insert([row("bill", "Aluguel do apê", 180_000), row("income", "Salário da empresa", 500_000)]);
    expect(error).toBeNull();

    await login(page, user, "/dinheiro");
    const list = page.getByRole("list", { name: "Contas e entradas a resolver" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list).toContainText("Aluguel do apê");
    await expect(list).toContainText(/R\$\s1\.800,00/);
    await expect(list).toContainText("Salário da empresa");
    expect(await a11y(page)).toEqual([]);

    await page.getByRole("button", { name: "Paguei: Aluguel do apê" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).not.toContainText("Aluguel do apê");
    await page.getByRole("button", { name: "Recebi: Salário da empresa" }).click();
    await expect(page.getByRole("list", { name: "Contas e entradas a resolver" })).toHaveCount(0);  // tudo resolvido: o cartão some

    const { data } = await admin.from("transactions").select("description, type, amount_cents, recurrence_id").eq("user_id", user.id).order("description");
    expect(data).toEqual([
      expect.objectContaining({ description: "Aluguel do apê", type: "expense", amount_cents: 180_000 }),
      expect.objectContaining({ description: "Salário da empresa", type: "income", amount_cents: 500_000 }),
    ]);
    expect(data!.every((t) => t.recurrence_id)).toBe(true);
    await page.goto("/dinheiro/extrato", { waitUntil: "networkidle" });
    await expect(page.getByText("Aluguel do apê").first()).toBeVisible();
  });

  test("F21-E1 conta cadastrada hoje com o dia já passado não aparece como atrasada", async ({ page, user }) => {
    const now = new Date();
    // no dia 1 o vencimento é hoje (e aparece como "vence hoje"): o caso só existe a partir do dia 2
    test.skip(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "numeric" }).format(now) === "1", "o dia 1 vence hoje");
    await admin.from("recurrences").insert({ user_id: user.id, kind: "bill", description: "Internet nova", amount_cents: 12_000, frequency: "monthly", interval_count: 1, anchor_on: `${now.toISOString().slice(0, 7)}-01` });
    await login(page, user, "/dinheiro");
    await expect(page.getByRole("heading", { name: "Dinheiro" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Contas e entradas a resolver" })).toHaveCount(0);
  });
});
