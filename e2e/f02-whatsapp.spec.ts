import { admin, expect, login, MOCK, mockCalls, test } from "./fixtures";

// F16 + F02: vincular o número pelo código e organizar pelo WhatsApp.
// O webhook é chamado como a UAZAPI chamaria; as respostas vão para o servidor falso.
const SECRET = "segredo-e2e";
const hook = (body: object, secret = SECRET) =>
  fetch(`http://localhost:3000/api/webhooks/whatsapp?secret=${secret}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const inbound = (id: string, from: string, text: string) => ({
  EventType: "messages", token: "token-e2e",
  message: { messageid: id, chatid: `${from}@s.whatsapp.net`, sender_pn: `${from}@s.whatsapp.net`, fromMe: false, isGroup: false, wasSentByApi: false, messageType: "Conversation", text, messageTimestamp: Date.now() },
});
const sentTo = async (digits: string) => (await mockCalls()).filter((c) => (c.url === "/send/text" || c.url === "/send/menu") && String(c.body.number) === digits).map((c) => String(c.body.text));
async function waitSent(digits: string, re: RegExp) {
  await expect.poll(async () => (await sentTo(digits)).some((t) => re.test(t)), { timeout: 15_000 }).toBe(true);
}
// número único por teste, para os testes rodarem em paralelo
const phone = () => `55119${String(Date.now()).slice(-8)}`;

test.describe("F02 e F16 WhatsApp", () => {
  test("F16-H1 vincular pelo código mandado do próprio WhatsApp", async ({ page, user }) => {
    const number = phone();
    await login(page, user, "/ajustes");
    await page.getByLabel("WhatsApp").fill(`(${number.slice(2, 4)}) ${number.slice(4, 9)}-${number.slice(9)}`);
    await page.getByRole("button", { name: "Vincular" }).click();
    const status = page.getByRole("status").filter({ hasText: "mande este código" });
    await expect(status).toBeVisible();
    await expect(page.getByText(`+${number} · aguardando o código`)).toBeVisible();  // a lista atualizou
    await expect(status).toBeVisible();  // e o código continua na tela
    const code = (await status.locator(".font-mono").textContent())!.trim();
    expect(code).toMatch(/^\d{6}$/);
    await expect(status.getByRole("link", { name: "Abrir o WhatsApp com o código" })).toHaveAttribute("href", new RegExp(`wa\\.me/5511900000000\\?text=.*${code}`));

    expect((await hook(inbound(`L-${number}`, number, `Meu código: ${code}`))).status).toBe(200);
    await waitSent(number, /Pronto!/);
    // a tela percebe sozinha que o código chegou, sem recarregar
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp vinculado!" })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(`+${number} · vinculado`)).toBeVisible();

    // F02-H1: texto vira lançamento, resposta no WhatsApp e aparece no app
    await hook(inbound(`T-${number}`, number, "gastei 27,90 no uber"));
    await waitSent(number, /Lançamento: .*R\$\s27,90/);
    await page.goto("/dinheiro/extrato");
    await expect(page.getByText(/uber/i).first()).toBeVisible();

    // F02-E1: o provedor reenviou a mesma mensagem: não grava de novo
    await hook(inbound(`T-${number}`, number, "gastei 27,90 no uber"));
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await admin.from("transactions").select("id").eq("user_id", user.id);
    expect(data).toHaveLength(1);
  });

  test("F02-E5 cinco mensagens de uma vez (encaminhadas juntas): nenhuma se perde", async ({ user }) => {
    const number = phone();
    await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: `+${number}`, verified_at: new Date().toISOString() });
    const texts = [11, 12, 13, 14, 15].map((v) => `gastei ${v} no lanche`);
    const statuses = await Promise.all(texts.map((t, i) => hook(inbound(`B${i}-${number}`, number, t)).then((r) => r.status)));
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    await expect.poll(async () => (await admin.from("transactions").select("id").eq("user_id", user.id)).data?.length, { timeout: 20_000 }).toBe(5);
    await expect.poll(async () => (await sentTo(number)).filter((t) => /Lançamento/.test(t)).length, { timeout: 20_000 }).toBe(5);
    // cada pergunta seguida da própria resposta, sem intercalar
    const { data } = await admin.from("messages").select("role, text_preview").eq("user_id", user.id).order("seq");
    const roles = data!.filter((m) => m.role !== "system").map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant"]);
  });

  test("F16-N1 código errado não vincula", async ({ page, user }) => {
    const number = phone();
    await login(page, user, "/ajustes");
    await page.getByLabel("WhatsApp").fill(number.slice(2));
    await page.getByRole("button", { name: "Vincular" }).click();
    await expect(page.getByRole("status").filter({ hasText: "mande este código" })).toBeVisible();
    // a tela diz de qual número o código tem que sair, para dar para ver um erro de digitação
    await expect(page.getByRole("status").filter({ hasText: "mande este código" })).toContainText(`${number.slice(2, 4)} ${number.slice(4, 9)}-${number.slice(9)}`);
    await hook(inbound(`X-${number}`, number, "Meu código: 000000"));
    await waitSent(number, /Recebi o código, mas ele não confere com este número \(final \d{4}\).*ainda não está ligado/);
    await page.reload();
    await expect(page.getByText(/aguardando o código/)).toBeVisible();
  });

  test("F16-H2 conta dividida: adiciona o WhatsApp de outra pessoa com o nome, até o limite do plano, e remove", async ({ page, user }) => {
    const mine = phone();
    await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: `+${mine}`, verified_at: new Date().toISOString() });
    await login(page, user, "/ajustes");
    await expect(page.getByText("1 de 2 números do seu plano")).toBeVisible();
    // nome de quem usa o primeiro número e avisos desligados nele
    const first = page.getByRole("listitem").filter({ hasText: `+${mine}` });
    await first.getByLabel("Nome de quem usa").fill("Fernando");
    await first.getByRole("button", { name: "Salvar" }).click();
    await expect.poll(async () => (await admin.from("channel_links").select("label").eq("user_id", user.id).single()).data?.label).toBe("Fernando");
    await page.getByRole("switch", { name: "Avisos no Fernando" }).click();
    await expect.poll(async () => (await admin.from("channel_links").select("receives_notices").eq("user_id", user.id).single()).data?.receives_notices).toBe(false);

    // segundo número, com o nome da pessoa
    const other = `55119${String(Date.now() + 7).slice(-8)}`;
    await page.getByRole("button", { name: "Adicionar outro WhatsApp" }).click();
    await page.getByLabel("Nome de quem vai usar").fill("Ana");
    await page.getByLabel("Número").fill(other.slice(2));
    await page.getByRole("button", { name: "Vincular" }).click();
    await expect(page.getByRole("status").filter({ hasText: "mande este código" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("2 de 2 números do seu plano")).toBeVisible();
    await expect(page.getByText(`+${other} · aguardando o código`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar outro WhatsApp" })).toBeHidden();
    await expect(page.getByRole("link", { name: "veja os planos" })).toBeVisible();

    // remover a Ana devolve a vaga
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Remover Ana" }).click();
    await expect(page.getByText("1 de 2 números do seu plano")).toBeVisible();
    expect((await admin.from("channel_links").select("id").eq("user_id", user.id)).data).toHaveLength(1);
  });

  test("F02-N1 número que não é de ninguém recebe a explicação de como vincular", async () => {
    const number = phone();
    await hook(inbound(`U-${number}`, number, "oi"));
    await waitSent(number, /ainda não está ligado/);
  });

  test("F02-N2 webhook sem o segredo certo é recusado", async () => {
    expect((await hook(inbound("Z1", phone(), "oi"), "errado")).status).toBe(401);
    const wrongToken = { ...inbound("Z2", phone(), "oi"), token: "outro" };
    expect((await hook(wrongToken)).status).toBe(401);
  });

  test("F02-E2 mensagens do próprio número e de grupos são ignoradas", async () => {
    const number = phone();
    const own = inbound(`O-${number}`, number, "oi"); own.message.fromMe = true;
    const group = inbound(`G-${number}`, number, "oi"); group.message.isGroup = true;
    await hook(own); await hook(group);
    await new Promise((r) => setTimeout(r, 1500));
    expect(await sentTo(number)).toEqual([]);
  });
});
void MOCK;

test.describe("Espelho no WhatsApp", () => {
  test("ESP-1 ligado: o que se conversa no app chega no WhatsApp; desligado, não; a chave pede um WhatsApp vinculado", async ({ page, user }) => {
    test.setTimeout(120_000);
    const number = phone();
    const mirrored = async () => (await sentTo(number)).filter((t) => t.includes("No app, você:"));
    const send = async (text: string) => {
      const box = page.getByLabel("Mensagem para o assistente");
      await box.fill(text);
      await box.press("Enter");
    };
    const toggle = page.getByRole("switch", { name: "Espelhar no WhatsApp o que eu conversar no app" });

    // sem WhatsApp vinculado a chave fica travada
    await login(page, user, "/ajustes/assistente");
    await expect(toggle).toBeDisabled();
    await expect(page.getByText("vincule um WhatsApp em Configurações para poder ligar")).toBeVisible();

    // com o número confirmado, liga (e fica salvo)
    await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: `+${number}`, verified_at: new Date().toISOString() });
    await page.reload();
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();  // desligado por padrão
    await toggle.click();
    await expect.poll(async () => (await admin.from("profiles").select("mirror_whatsapp").eq("user_id", user.id).single()).data?.mirror_whatsapp).toBe(true);

    // conversa no app: a pergunta e a resposta aparecem no WhatsApp
    await page.goto("/conversa", { waitUntil: "networkidle" });
    await send("gastei 33 no espelho um");
    await expect(page.getByRole("article", { name: /Lançamento salvo/ }).first()).toBeVisible();
    await expect.poll(async () => (await mirrored()).length, { timeout: 20_000 }).toBe(1);
    const text = (await mirrored())[0];
    expect(text).toContain("gastei 33 no espelho um");
    expect(text).toMatch(/🤖[\s\S]*✅ Lançamento: [\s\S]*R\$\s33,00/);

    // desliga: o app continua funcionando e nada mais vai para o WhatsApp
    await page.goto("/ajustes/assistente", { waitUntil: "networkidle" });
    await toggle.click();
    await expect.poll(async () => (await admin.from("profiles").select("mirror_whatsapp").eq("user_id", user.id).single()).data?.mirror_whatsapp).toBe(false);
    await page.goto("/conversa", { waitUntil: "networkidle" });
    await send("gastei 44 no espelho dois");
    await expect(page.getByRole("article", { name: /Lançamento salvo/ }).nth(1)).toBeVisible();
    await new Promise((r) => setTimeout(r, 3000));
    expect(await mirrored()).toHaveLength(1);
  });
});
