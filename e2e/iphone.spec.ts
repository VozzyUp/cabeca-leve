import { expect, login, test } from "./fixtures";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test.describe("App no iPhone", () => {
  test("PWA-H1 o app é instalável: manifesto em modo app e ícones do iPhone", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({ display: "standalone", start_url: "/conversa", scope: "/", name: "Peraí" });
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const i of m.icons) expect((await page.request.get(i.src)).status()).toBe(200);
    await page.goto("/entrar");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
    await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
    expect((await page.request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
  });

  test("PWA-H2 no Safari do iPhone (fora da Tela de Início), ligar a notificação ensina a instalar em vez de falhar calado", async ({ browser, user }) => {
    const context = await browser.newContext({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, locale: "pt-BR" });
    const page = await context.newPage();
    // o ambiente de teste não tem chave de notificação: simula uma, como em produção
    await page.route("**/env.js", async (route) => {
      const body = (await (await route.fetch()).text()).replace('"vapidPublicKey":null', '"vapidPublicKey":"BChaveDeTesteSoParaATelaNaoEnviaNada"');
      await route.fulfill({ body, contentType: "application/javascript" });
    });
    try {
      await login(page, user, "/ajustes");
      const push = page.getByRole("switch", { name: "Notificações no aparelho" });
      const before = await push.getAttribute("aria-checked");
      if (before === "true") { await push.click(); await expect(push).toHaveAttribute("aria-checked", "false"); }
      await push.click();
      await expect(page.getByText(/Adicionar à Tela de Início/)).toBeVisible();
      await expect(push).toHaveAttribute("aria-checked", "false");  // não finge que ligou
    } finally {
      await context.close();
    }
  });
});
