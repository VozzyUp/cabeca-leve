import { admin, expect, login, test } from "./fixtures";

test.describe("Navegação e configuração inicial", () => {
  test("NAV-H1 barra de cima: avisos com contador, menu da conta e sair @celular", async ({ page, user }) => {
    await admin.from("notices").insert({ user_id: user.id, kind: "system", title: "Oi", body: "teste", href: "/avisos" });
    await login(page, user, "/tarefas");
    const bell = page.getByRole("link", { name: /Avisos \(\d+ novos?\)/ });
    await expect(bell).toBeVisible();
    await page.getByRole("button", { name: "Sua conta" }).click();
    await expect(page.getByRole("link", { name: "Configurar assistente" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Configurar assistente" })).toBeHidden();
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
    await dialog.getByRole("radio", { name: /^Divertido/ }).click();
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

  test("ONB-H2 WhatsApp na configuração inicial: só continua depois de vincular (ou de pular)", async ({ page, user }) => {
    test.setTimeout(90_000);
    const number = `55119${String(Date.now()).slice(-8)}`;
    await admin.from("profiles").update({ onboarded_at: null }).eq("user_id", user.id);
    await login(page, user);
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Como quer que eu chame você?").fill("Bia");
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByRole("heading", { name: "Fale comigo pelo WhatsApp" })).toBeVisible();
    // digitar o número não basta: não há Continuar, e Vincular é o botão principal
    await dialog.getByLabel("Seu número de WhatsApp").fill(number.slice(2));
    await expect(dialog.getByRole("button", { name: "Continuar" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Pular por agora" })).toBeVisible();
    await dialog.getByRole("button", { name: "Vincular" }).click();
    const status = dialog.getByRole("status").filter({ hasText: "mande este código" });
    await expect(status).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continuar" })).toHaveCount(0);  // com o código na tela, ainda falta mandar
    // o código chega pelo WhatsApp: a janela percebe e libera o Continuar
    const code = (await status.locator(".font-mono").textContent())!.trim();
    const res = await fetch("http://localhost:3000/api/webhooks/whatsapp?secret=segredo-e2e", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      EventType: "messages", token: "token-e2e",
      message: { messageid: `onb-${number}`, chatid: `${number}@s.whatsapp.net`, sender_pn: `${number}@s.whatsapp.net`, fromMe: false, isGroup: false, wasSentByApi: false, messageType: "Conversation", text: `Meu código: ${code}`, messageTimestamp: Date.now() },
    }) });
    expect(res.status).toBe(200);
    await expect(dialog.getByRole("status").filter({ hasText: "WhatsApp vinculado" }).first()).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByRole("heading", { name: "Como você quer ser avisado" })).toBeVisible();
  });

  test("ONB-H3 refazer pelo menu abre sempre: de novo depois de fechar, vindo de outra tela e no meio do caminho @celular", async ({ page, user }) => {
    test.setTimeout(90_000);
    await login(page, user);
    const dialog = page.getByRole("dialog");
    const refazer = async () => {
      await page.getByRole("button", { name: "Sua conta" }).click();
      await page.getByRole("link", { name: "Refazer a configuração inicial" }).click();
    };
    // 1) pela conversa, fecha no X; 2) pede de novo e abre outra vez, sem recarregar
    await refazer();
    await expect(dialog.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/configurar/);
    await refazer();
    await expect(dialog.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
    // 3) avança até o passo do WhatsApp, fecha, e o próximo pedido volta ao primeiro passo
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByRole("heading", { name: "Fale comigo pelo WhatsApp" })).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();
    await refazer();
    await expect(dialog.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar" }).click();
    // 4) de outra tela (Configurações) o menu leva à conversa e abre
    await page.goto("/ajustes");
    await page.waitForLoadState("networkidle");
    await refazer();
    await expect(page).toHaveURL(/\/conversa/);
    await expect(dialog.getByRole("heading", { name: /Boas-vindas/ })).toBeVisible();
  });

  test("ONB-H4 refazer com um número pendente: o botão é Vincular, o número novo troca o antigo e o código aparece @celular", async ({ page, user }) => {
    test.setTimeout(90_000);
    const stamp = String(Date.now()).slice(-4);
    const old = `+55119${stamp}1001`, fresh = `55119${stamp}1002`;
    // sobrou uma tentativa de antes, com o número errado e ainda sem confirmar
    await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: old, verified_at: null, verification_code_hash: "x", verification_expires_at: new Date(Date.now() + 600_000).toISOString() });
    await login(page, user);
    await page.getByRole("button", { name: "Sua conta" }).click();
    await page.getByRole("link", { name: "Refazer a configuração inicial" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByRole("heading", { name: "Fale comigo pelo WhatsApp" })).toBeVisible();
    // número ainda não confirmado: o botão é Vincular (Trocar é só para número já confirmado), e não há Continuar
    await expect(dialog.getByRole("button", { name: "Trocar" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Continuar" })).toHaveCount(0);
    await dialog.getByLabel("Seu número de WhatsApp").fill(fresh.slice(2));
    await dialog.getByRole("button", { name: "Vincular" }).click();
    const status = dialog.getByRole("status").filter({ hasText: "mande este código" });
    await expect(status).toBeVisible();
    await expect(status.getByRole("link", { name: "Abrir o WhatsApp com o código" })).toBeVisible();
    await expect(dialog.getByText(`Aguardando confirmação: +${fresh}`)).toBeVisible();
    // o número errado sai de cena: só o novo espera confirmação
    expect((await admin.from("channel_links").select("external_id").eq("user_id", user.id)).data).toEqual([{ external_id: `+${fresh}` }]);
  });

  test("ONB-E1 fechar no primeiro passo conta como feito", async ({ page, user }) => {
    await admin.from("profiles").update({ onboarded_at: null }).eq("user_id", user.id);
    await login(page, user);
    await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(async () => (await admin.from("profiles").select("onboarded_at").eq("user_id", user.id).single()).data?.onboarded_at).not.toBeNull();
  });
});
