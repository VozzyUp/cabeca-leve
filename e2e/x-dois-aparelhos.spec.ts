import { expect, login, test } from "./fixtures";

// Mesma conta aberta em dois aparelhos: o que muda num aparece no outro sem recarregar
test("X-E2 conversa no computador, celular em Tarefas atualiza sozinho", async ({ browser, page, user }) => {
  const phone = await (await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 390, height: 844 } })).newPage();
  await login(phone, user, "/tarefas");
  await phone.getByRole("radio", { name: /Próximas/ }).click();
  await login(page, user);
  const box = page.getByLabel("Mensagem para o assistente");
  await box.fill("cria uma tarefa de renovar a CNH amanhã");
  await box.press("Enter");
  await expect(page.getByRole("article", { name: /Tarefa salvo/ })).toBeVisible();
  await expect(phone.getByText(/Renovar a CNH/i)).toBeVisible({ timeout: 15_000 });
  await phone.context().close();
});
