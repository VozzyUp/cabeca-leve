import { expect, login, test } from "./fixtures";

// Só com o teclado: criar, editar (janela com Esc) e concluir uma tarefa
test("X-E1 tarefa do começo ao fim só com o teclado", async ({ page, user }) => {
  await login(page, user, "/tarefas");
  await page.getByLabel("Nova tarefa").focus();
  await page.keyboard.type("Pagar o condomínio");
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: /Sem prazo/ }).focus();
  await page.keyboard.press("Space");
  const check = page.getByRole("checkbox", { name: /Pagar o condomínio/ });
  await expect(check).toBeVisible();
  await page.getByRole("button", { name: "Editar Pagar o condomínio" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Editar tarefa" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);  // o foco entra na janela
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Editar Pagar o condomínio" })).toBeFocused();  // e volta para quem abriu
  await check.focus();
  await page.keyboard.press("Space");
  await expect(check).toHaveCount(0);  // concluída sai da lista e vai para Feitas
  await page.getByRole("radio", { name: /Feitas/ }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: /Pagar o condomínio/ })).toBeChecked();
});
