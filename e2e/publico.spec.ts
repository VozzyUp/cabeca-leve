import { expect, login, noHorizontalScroll, test } from "./fixtures";

test.describe("Início e páginas legais", () => {
  test("PUB-H1 quem não entrou vê a página inicial, com preço e os links legais", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Tire a vida da cabeça" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Começar 7 dias grátis/ }).first()).toHaveAttribute("href", "/entrar?modo=criar");
    await expect(page.getByText(/R\$\s*39,90/).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("PUB-H2 quem já entrou vai da página inicial direto para a conversa", async ({ page, user }) => {
    await login(page, user);
    await page.goto("/");
    await expect(page).toHaveURL(/\/conversa/);
  });

  test("PUB-H3 política e termos abrem sem entrar e citam o essencial", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
    await expect(page.getByText(/LGPD/).first()).toBeVisible();
    await expect(page.getByText(/depois de 2 dias/)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("link", { name: "Termos de uso" }).first().click();
    await expect(page).toHaveURL(/\/termos/);
    await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
    await expect(page.getByText(/7 dias corridos/)).toBeVisible();
  });

  test("PUB-H4 o cadastro avisa que criar a conta aceita os termos, com links", async ({ page }) => {
    await page.goto("/entrar?modo=criar");
    await expect(page.getByText(/Ao criar a conta, você concorda/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Termos de uso" }).first()).toHaveAttribute("href", "/termos");
  });
});
