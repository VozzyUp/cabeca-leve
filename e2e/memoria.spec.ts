import { a11y, admin, expect, login, test } from "./fixtures";

// Memória do assistente: a pessoa vê o que ficou guardado e esquece um item ou tudo
test.describe("F20 memória do assistente", () => {
  test("F20-H1 lista o que foi guardado, esquece um item e depois tudo, e some do banco", async ({ page, user }) => {
    await admin.from("memories").insert([
      { user_id: user.id, fact: "Recebe o salário no dia 5" }, { user_id: user.id, fact: "É vegetariana" }, { user_id: user.id, fact: "A filha se chama Ana" },
    ]);
    await login(page, user, "/ajustes/assistente");
    const list = page.getByRole("list", { name: "O que o assistente guardou" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list).toContainText("Recebe o salário no dia 5");
    expect(await a11y(page)).toEqual([]);

    await page.getByRole("button", { name: "Esquecer: É vegetariana" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list).not.toContainText("vegetariana");
    await expect.poll(async () => (await admin.from("memories").select("id").eq("user_id", user.id)).data?.length).toBe(2);

    await page.getByRole("button", { name: "Esquecer tudo" }).click();
    await expect(page.getByText("Esquecer os 2 itens?")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);  // cancelou: nada some
    await page.getByRole("button", { name: "Esquecer tudo" }).click();
    await page.getByRole("button", { name: "Sim, esquecer tudo" }).click();
    await expect(page.getByText(/Nada guardado ainda/)).toBeVisible();
    await expect.poll(async () => (await admin.from("memories").select("id").eq("user_id", user.id)).data?.length).toBe(0);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/Nada guardado ainda/)).toBeVisible();
  });

  test("F20-E1 com a memória desligada o aviso aparece, o que já foi guardado continua e pode ser apagado", async ({ page, user }) => {
    await admin.from("memories").insert({ user_id: user.id, fact: "Gosta de café sem açúcar" });
    await admin.from("profiles").update({ memory_enabled: false }).eq("user_id", user.id);
    await login(page, user, "/ajustes/assistente");
    await expect(page.getByText(/A memória está desligada/)).toBeVisible();
    await expect(page.getByText("Gosta de café sem açúcar")).toBeVisible();
    await page.getByRole("button", { name: "Esquecer: Gosta de café sem açúcar" }).click();
    await expect(page.getByText("Nada guardado.")).toBeVisible();
  });
});
