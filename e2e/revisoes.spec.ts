import { admin, expect, login, test } from "./fixtures";

test("REV-H1 trocar por onde a pesquisa chega, direto no card, e fica salvo", async ({ page, user }) => {
  const { data } = await admin.from("automations").insert({
    user_id: user.id, title: "GitHub popular", instruction: "repositórios mais populares", sources: ["web"], schedule: "daily", run_time: "08:00",
    timezone: "America/Sao_Paulo", channel: "push", next_run_at: new Date(Date.now() + 3_600_000).toISOString(),
  }).select("id").single();
  await login(page, user, "/automacoes");
  await expect(page.getByText(/· pesquisa na internet/)).toBeVisible();
  const select = page.getByRole("combobox", { name: "Por onde chega: GitHub popular" });
  await expect(select).toHaveValue("push");
  await select.selectOption("whatsapp");
  await expect.poll(async () => (await admin.from("automations").select("channel").eq("id", data!.id).single()).data?.channel).toBe("whatsapp");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Por onde chega: GitHub popular" })).toHaveValue("whatsapp");
});
