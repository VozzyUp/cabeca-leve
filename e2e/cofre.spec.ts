import { a11y, admin, expect, login, test } from "./fixtures";

test.describe("Cofre de senhas", () => {
  test("COF-H1 cria com a senha mestra, guarda um login, tranca, recusa a senha errada e abre de novo; o banco só tem cifrado @celular", async ({ page, user }) => {
    test.setTimeout(120_000);  // a chave sai de 600 mil rodadas de PBKDF2
    await login(page, user, "/cofre");
    await expect(page.getByRole("heading", { name: "Crie a sua senha mestra" })).toBeVisible();
    await page.getByLabel("Senha mestra", { exact: true }).fill("uma frase longa e boa");
    await page.getByLabel("Repita a senha mestra").fill("uma frase longa e boa");
    await page.getByRole("button", { name: "Criar o cofre" }).click();
    await expect(page.getByText("Cofre vazio")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Novo item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Banco Azul");
    await dialog.getByLabel("Endereço do site").fill("banco-azul.com.br");
    await dialog.getByLabel("Login ou e-mail").fill("fernando@exemplo.com");
    await dialog.getByLabel("Senha", { exact: true }).fill("Segredo-Muito-Forte-42");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Banco Azul")).toBeVisible();
    await expect(page.getByText("fernando@exemplo.com · banco-azul.com.br")).toBeVisible();
    await page.getByRole("button", { name: "Mostrar senha de Banco Azul" }).click();
    await expect(page.getByText("Segredo-Muito-Forte-42")).toBeVisible();
    expect(await a11y(page)).toEqual([]);

    // no banco: nada legível
    const { data: rows } = await admin.from("vault_items").select("ciphertext").eq("user_id", user.id);
    expect(rows).toHaveLength(1);
    const raw = rows![0].ciphertext + Buffer.from(rows![0].ciphertext, "base64").toString("latin1");
    for (const secret of ["Segredo", "fernando", "Banco Azul", "banco-azul"]) expect(raw).not.toContain(secret);

    await page.getByRole("button", { name: "Trancar" }).click();
    await expect(page.getByText("Banco Azul")).toBeHidden();
    await page.getByLabel("Senha mestra").fill("senha errada qualquer");
    await page.getByRole("button", { name: "Destrancar" }).click();
    await expect(page.getByText("Senha mestra errada.")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Senha mestra").fill("uma frase longa e boa");
    await page.getByRole("button", { name: "Destrancar" }).click();
    await expect(page.getByText("Banco Azul")).toBeVisible({ timeout: 20_000 });

    // recarregar a página tranca (a chave só vive na memória da tela)
    await page.reload();
    await expect(page.getByRole("heading", { name: "Cofre trancado" })).toBeVisible();
  });

  test("COF-H2 gera senha forte, edita e apaga um item", async ({ page, user }) => {
    test.setTimeout(120_000);
    await login(page, user, "/cofre");
    await page.getByLabel("Senha mestra", { exact: true }).fill("outra frase bem longa");
    await page.getByLabel("Repita a senha mestra").fill("outra frase bem longa");
    await page.getByRole("button", { name: "Criar o cofre" }).click();
    await page.getByRole("button", { name: "Novo item" }).click({ timeout: 20_000 });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Streaming");
    await dialog.getByRole("button", { name: "Gerar senha forte" }).click();
    await expect(dialog.getByLabel("Senha", { exact: true })).toHaveValue(/^.{20}$/);
    await expect(dialog.getByText("Força: forte")).toBeVisible();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await page.getByRole("button", { name: "Editar Streaming" }).click();
    await dialog.getByLabel("Nome").fill("Streaming da família");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Streaming da família")).toBeVisible();
    await page.getByRole("button", { name: "Editar Streaming da família" }).click();
    page.once("dialog", (d) => d.accept());
    await dialog.getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText("Cofre vazio")).toBeVisible();
    expect((await admin.from("vault_items").select("id").eq("user_id", user.id)).data).toEqual([]);
  });
});
