import { a11y, expect, noHorizontalScroll, test } from "./fixtures";

// App na tela inicial do celular: a tela fica parada (sem arrastar para o lado), o teclado encolhe a página
// e não existe zoom (nem de pinça, nem o do iPhone ao tocar num campo).
test("INS-1 viewport e rolagem: tela fixa, sem zoom e sem arrasto para o lado @celular", async ({ page }) => {
  await page.goto("/entrar", { waitUntil: "networkidle" });
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("width=device-width");
  expect(viewport).toContain("interactive-widget=resizes-content");
  expect(viewport).toMatch(/user-scalable=no/);
  expect(viewport).toMatch(/maximum-scale=1(,|$)/);
  expect(viewport).toMatch(/minimum-scale=1(,|$)/);
  const touch = await page.evaluate(() => [getComputedStyle(document.documentElement).touchAction, getComputedStyle(document.documentElement).overscrollBehaviorY]);
  expect(touch).toEqual(["pan-x pan-y", "none"]);
  const overflow = await page.evaluate(() => [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX]);
  expect(overflow).toEqual(["hidden", "clip"]);
  expect(await noHorizontalScroll(page)).toBe(true);
  // tentar empurrar a página para o lado não move nada
  await page.evaluate(() => window.scrollTo(200, 0));
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  // iPhone dá zoom ao tocar num campo com letra menor que 16px: em tela de toque os campos têm 16px
  if (test.info().project.name === "celular") {
    expect(await page.getByLabel("E-mail").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  }
  expect(await a11y(page)).toEqual([]);
});

test("INS-2 o manifesto abre como app, sem a barra do navegador", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/conversa", scope: "/" });
});
