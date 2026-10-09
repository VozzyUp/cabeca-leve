import { admin, expect, login, test } from "./fixtures";

test.describe("Navegação e configuração inicial", () => {
  test("NAV-H1 barra de cima: avisos com contador, menu da conta e sair @celular", async ({ page, user }) => {
    await admin.from("notices").insert({ user_id: user.id, kind: "system", title: "Oi", body: "teste", href: "/avisos" });
    await login(page, user, "/tarefas");
    const bell = page.getByRole("link", { name: /Avisos \(\d+ novos?\)/ });
    await expect(bell).toBeVisible();
    await page.getByRole("button", { name: "Sua conta" }).click();
    await expect(page.getByRole("link", { name: "Jeito do assistente" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Jeito do assistente" })).toBeHidden();
    await bell.click();
    await expect(page).toHaveURL(/\/avisos/);
    await page.getByRole("button", { name: "Sua conta" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("NAV-H2 voltar: volta para onde estava e, sem histórico, sobe um nível @celular", async ({ page, user }) => {
    test.skip(test.info().project.name !== "celular", "no computador o menu lateral leva a todas as seções");
    await login(page, user, "/mais");
    await page.getByRole("main").getByRole("link", { name: /^Notas/ }).click();
    await expect(page).toHaveURL(/\/notas/);
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/mais/);
    await page.goto("/ajustes/assistente");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/ajustes$/);
  });

  test("NAV-H3 trocar o tema pela barra de cima vale na hora e fica salvo", async ({ page, user }) => {
    await login(page, user, "/dia");
    await page.getByRole("button", { name: "Usar o tema claro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(async () => (await admin.from("profiles").select("theme").eq("user_id", user.id).single()).data?.theme).toBe("light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Usar o tema escuro" })).toBeVisible();
  });

  test("ONB-H1 conta nova: a configuração inicial abre sozinha, salva e não volta mais @celular", async ({ page, user }) => {
    await admin.from("profiles").update({ onboarded_at: null }).eq("user_id", user.id);
    await login(page, user);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
    await dialog.getByLabel("Como quer que eu chame você?").fill("Ana Clara");
    await dialog.getByText("Divertido").click();
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByRole("heading", { name: "Fale comigo pelo WhatsApp" })).toBeVisible();
    await dialog.getByRole("button", { name: "Pular por agora" }).click();
    await expect(dialog.getByRole("heading", { name: "Como você quer ser avisado" })).toBeVisible();
    await dialog.getByRole("switch", { name: "Resumo da manhã" }).click();
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await dialog.getByRole("button", { name: "Começar a usar" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await admin.from("profiles").select("display_name, assistant_tone, onboarded_at").eq("user_id", user.id).single()).data)
      .toMatchObject({ display_name: "Ana Clara", assistant_tone: "playful", onboarded_at: expect.any(String) });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toBeHidden();
    // dá para refazer pelo menu da conta
    await page.getByRole("button", { name: "Sua conta" }).click();
    await page.getByRole("link", { name: "Refazer a configuração inicial" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Como quer que eu chame você?")).toHaveValue("Ana Clara");
  });

  test("ONB-E1 fechar no primeiro passo conta como feito", async ({ page, user }) => {
    await admin.from("profiles").update({ onboarded_at: null }).eq("user_id", user.id);
    await login(page, user);
    await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(async () => (await admin.from("profiles").select("onboarded_at").eq("user_id", user.id).single()).data?.onboarded_at).not.toBeNull();
  });
});
