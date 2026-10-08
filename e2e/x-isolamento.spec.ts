import { createClient } from "@supabase/supabase-js";
import { admin, createUser, expect, login, PASSWORD, test } from "./fixtures";

// Dados de uma pessoa são invisíveis e intocáveis para outra: pelas telas, pela API do app
// e direto no Supabase com a chave pública (RLS).
test("X-N1 segunda conta não vê nem altera nada da primeira", async ({ browser, user: a }) => {
  const pa = await (await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" })).newPage();
  await login(pa, a);
  const box = pa.getByLabel("Mensagem para o assistente");
  await box.fill("gastei 77 na farmácia e me lembra do dentista amanhã às 10h");
  await box.press("Enter");
  await expect(pa.getByRole("article", { name: /Lembrete salvo/ })).toBeVisible();
  const { task } = await (await pa.request.post("/api/tasks", { data: { title: "Segredo da Ana", dueOn: null, priority: "medium" } })).json();
  const { data: rem } = await admin.from("reminders").select("id").eq("user_id", a.id).single();
  const { data: act } = await admin.from("actions").select("id").eq("user_id", a.id).limit(1).single();

  const b = await createUser("Bia");
  const pb = await (await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" })).newPage();
  try {
    await login(pb, b);
    for (const [path, text] of [["/tarefas", "Segredo da Ana"], ["/dinheiro/extrato", "farmácia"], ["/lembretes", "dentista"], ["/conversa", "farmácia"]] as const) {
      await pb.goto(path, { waitUntil: "networkidle" });
      if (path === "/tarefas") await pb.getByRole("radio", { name: /Sem prazo/ }).click();
      await expect(pb.getByText(new RegExp(text, "i")), `${path} não mostra dados da outra conta`).toHaveCount(0);
    }
    expect((await pb.request.patch(`/api/tasks/${task.id}`, { data: { title: "invadido" } })).status()).toBe(404);
    expect((await pb.request.delete(`/api/tasks/${task.id}`)).status()).toBe(404);
    expect((await pb.request.delete(`/api/reminders/${rem!.id}`)).status()).toBe(404);
    expect((await pb.request.post(`/api/actions/${act!.id}/undo`)).status()).toBeGreaterThanOrEqual(400);
    const { data: still } = await admin.from("tasks").select("title").eq("id", task.id).single();
    expect(still!.title).toBe("Segredo da Ana");
    expect((await admin.from("reminders").select("id").eq("id", rem!.id)).data).toHaveLength(1);

    // direto no banco com a chave pública e a sessão da Bia
    const asB = createClient("http://127.0.0.1:54321", "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH", { auth: { persistSession: false } });
    await asB.auth.signInWithPassword({ email: b.email, password: PASSWORD });
    for (const table of ["tasks", "transactions", "reminders", "messages", "profiles", "channel_links", "subscriptions"] as const) {
      const { data } = await asB.from(table).select("user_id");
      expect((data ?? []).every((r: { user_id: string }) => r.user_id === b.id), `RLS em ${table}`).toBe(true);
    }
    const ins = await asB.from("tasks").insert({ user_id: a.id, title: "plantado" });
    expect(ins.error).not.toBeNull();
    const upd = await asB.from("tasks").update({ title: "mudado" }).eq("id", task.id).select();
    expect(upd.data ?? []).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(b.id);
    await pa.context().close();
    await pb.context().close();
  }
});
