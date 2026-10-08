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
const sentTo = async (digits: string) => (await mockCalls()).filter((c) => c.url === "/send/text" && String(c.body.number) === digits).map((c) => String(c.body.text));
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
    const code = (await status.locator(".font-mono").textContent())!.trim();
    expect(code).toMatch(/^\d{6}$/);
    await expect(status.getByRole("link", { name: "Abrir o WhatsApp com o código" })).toHaveAttribute("href", new RegExp(`wa\\.me/5511900000000\\?text=.*${code}`));

    expect((await hook(inbound(`L-${number}`, number, `Meu código: ${code}`))).status).toBe(200);
    await waitSent(number, /Pronto!/);
    await page.reload();
    await expect(page.getByText(`Vinculado: `)).toBeVisible();

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
    await hook(inbound(`X-${number}`, number, "Meu código: 000000"));
    await waitSent(number, /ainda não está ligado/);
    await page.reload();
    await expect(page.getByText(/Aguardando confirmação/)).toBeVisible();
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
