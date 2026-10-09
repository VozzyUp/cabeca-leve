import type { Page } from "@playwright/test";
import { admin, createUser, expect, login, mockCalls, PASSWORD, test, type TestUser } from "./fixtures";

// F1, F2 e F3 do replica/fixes.md: o que mais irrita quem usa o original.
const TOKEN = "token-do-webhook-e2e-com-mais-de-32-caracteres";
const asaas = (body: object) => fetch("http://localhost:3000/api/webhooks/asaas", {
  method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": TOKEN }, body: JSON.stringify(body),
});
const emailsTo = async (to: string) => (await mockCalls()).filter((c) => c.url === "/emails" && (c.body.to as string[])?.includes(to));

// abre a página de pagamento (interceptada: nada sai para a Asaas de verdade) e devolve o id do checkout
async function openCheckout(page: Page, button = "Assinar no cartão") {
  let url = "";
  await page.route(/https:\/\/(sandbox\.)?asaas\.com\/.*/, (r) => { url = r.request().url(); return r.fulfill({ body: "checkout falso" }); });
  await page.goto("/planos", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: button }).click();
  await expect.poll(() => url).toMatch(/checkoutSession/);
  await page.unroute(/asaas\.com/);
  return new URL(url).searchParams.get("id")!;
}

async function subscribe(page: Page, run: string) {
  const checkoutId = await openCheckout(page);
  const cus = `cus_${run}`, sub = `sub_${run}`;
  await asaas({ id: `a1_${run}`, event: "CHECKOUT_PAID", checkout: { id: checkoutId, customer: cus } });
  await asaas({ id: `a2_${run}`, event: "SUBSCRIPTION_CREATED", subscription: { id: sub, customer: cus } });
  await asaas({ id: `a3_${run}`, event: "PAYMENT_CONFIRMED", payment: { id: `pay1_${run}`, customer: cus, subscription: sub, dueDate: new Date().toISOString().slice(0, 10) } });
  return { cus, sub };
}

test.describe("F1 cancelar com comprovante", () => {
  test("F17-H2 cancelar mostra protocolo, manda e-mail e estorna cobrança que chegar depois", async ({ page, user }) => {
    const run = `${Date.now()}`;
    await login(page, user, "/planos");
    const { cus, sub } = await subscribe(page, run);
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "Cancelar assinatura" }).click();
    const note = page.getByRole("note").filter({ hasText: "Assinatura cancelada em" });
    await expect(note).toBeVisible();
    await expect(note).toContainText(/CL-[A-Z2-9]{6}/);
    await expect.poll(async () => (await emailsTo(user.email)).map((c) => c.body.subject)).toContain("Cabeça Leve: comprovante de cancelamento");
    await page.goto("/avisos");
    await expect(page.getByText("Assinatura cancelada").first()).toBeVisible();

    // a Asaas cobra o mês seguinte mesmo assim: estorno automático e aviso
    const { data: before } = await admin.from("subscriptions").select("current_period_end").eq("provider_subscription_id", sub).single();
    const nextMonth = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
    expect((await asaas({ id: `a4_${run}`, event: "PAYMENT_CONFIRMED", payment: { id: `pay2_${run}`, customer: cus, subscription: sub, dueDate: nextMonth } })).status).toBe(200);
    expect((await mockCalls()).some((c) => c.method === "POST" && c.url === `/v3/payments/pay2_${run}/refund`)).toBe(true);
    const { data: after } = await admin.from("subscriptions").select("current_period_end").eq("provider_subscription_id", sub).single();
    expect(after!.current_period_end).toBe(before!.current_period_end);  // não ganhou mais um mês
    await page.reload();
    await expect(page.getByText("Cobrança estornada")).toBeVisible();
  });
});

test.describe("F2 pagamento em confirmação", () => {
  test("F15-E4 teste vencido: voltou do pagamento, usa o app enquanto a Asaas confirma, e depois fica ativo", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user, "/planos");
    const checkoutId = await openCheckout(page);
    await page.goto("/planos/obrigado");
    await expect(page.getByRole("heading", { name: "Confirmando o pagamento…" })).toBeVisible();
    await page.goto("/conversa", { waitUntil: "networkidle" });
    const box = page.getByLabel("Mensagem para o assistente");
    await box.fill("gastei 10 no café");
    await box.press("Enter");
    await expect(page.getByRole("article", { name: /Lançamento salvo/ })).toBeVisible();  // e não "teste grátis terminou"
    await page.goto("/ajustes");
    await expect(page.getByText(/Pagamento em confirmação/)).toBeVisible();

    await page.goto("/planos/obrigado");
    const run = `${Date.now()}`;
    await asaas({ id: `b1_${run}`, event: "CHECKOUT_PAID", checkout: { id: checkoutId, customer: `cus_${run}` } });
    await expect(page.getByRole("heading", { name: "Plano ativo" })).toBeVisible({ timeout: 20_000 });
  });

  test("F15-N5 abrir a página de obrigado sem ter pago não libera nada", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user, "/planos/obrigado");
    await page.goto("/conversa", { waitUntil: "networkidle" });
    const box = page.getByLabel("Mensagem para o assistente");
    await box.fill("gastei 10 no café");
    await box.press("Enter");
    await expect(page.getByText(/Seu teste grátis terminou/)).toBeVisible();
  });
});

test.describe("F3 falar com uma pessoa", () => {
  const ADMIN = "dono-e2e@exemplo.com.br";
  async function adminUser(): Promise<TestUser> {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const old = data.users.find((u) => u.email === ADMIN);
    if (old) await admin.auth.admin.deleteUser(old.id);
    const { data: created, error } = await admin.auth.admin.createUser({ email: ADMIN, password: PASSWORD, email_confirm: true, user_metadata: { name: "Dono" } });
    if (error) throw error;
    return { id: created.user!.id, email: ADMIN, name: "Dono" };
  }

  test("F3-H1 abrir chamado pela tela, o time é avisado, responde pelo painel e a pessoa recebe", async ({ page, browser, user }) => {
    test.setTimeout(120_000);
    await login(page, user, "/ajustes");
    await page.getByRole("link", { name: /Falar com uma pessoa/ }).click();
    await page.getByLabel("O que aconteceu?").fill("Paguei pelo Pix e o app ainda diz que estou sem plano.");
    await page.getByRole("button", { name: "Chamar uma pessoa" }).click();
    const status = page.getByRole("status").filter({ hasText: "Chamado aberto" });
    await expect(status).toBeVisible();
    const protocol = (await status.locator(".font-mono").textContent())!.trim();
    expect(protocol).toMatch(/^CL-[A-Z2-9]{6}$/);
    // o time é avisado na hora, por e-mail e WhatsApp
    await expect.poll(async () => (await emailsTo("time@exemplo.com.br")).map((c) => c.body.subject)).toContain(`[Cabeça Leve] Chamado ${protocol}`);
    expect((await mockCalls()).some((c) => (c.url === "/send/text" || c.url === "/send/menu") && c.body.number === "5511988887777" && String(c.body.text).includes(protocol))).toBe(true);

    // painel do time
    const owner = await adminUser();
    const panel = await (await browser.newContext({ locale: "pt-BR" })).newPage();
    try {
      await login(panel, owner, "/suporte/painel");
      const card = panel.locator("div").filter({ hasText: protocol }).filter({ has: panel.getByRole("button", { name: "Responder e avisar" }) }).last();
      await card.getByLabel(`Resposta para ${protocol}`).fill("Oi! O Pix foi confirmado agora; seu plano já está ativo.");
      await card.getByRole("button", { name: "Responder e avisar" }).click();
      await expect(panel.getByText(protocol)).toHaveCount(0);
    } finally {
      await panel.context().close();
      await admin.auth.admin.deleteUser(owner.id);
    }

    await page.goto("/ajustes/suporte");
    await expect(page.getByText("O Pix foi confirmado agora; seu plano já está ativo.")).toBeVisible();
    await expect(page.getByText("respondido")).toBeVisible();
    await expect.poll(async () => (await emailsTo(user.email)).map((c) => c.body.subject)).toContain(`Cabeça Leve: resposta ao chamado ${protocol}`);
  });

  test("F3-N1 quem não é do time não vê o painel", async ({ page, user }) => {
    await login(page, user);
    // a página já começou a ser enviada (layout com carregamento), então o código fica 200: vale o conteúdo
    await page.goto("/suporte/painel");
    await expect(page.getByRole("heading", { name: "Chamados abertos" })).toHaveCount(0);
    await expect(page.getByText(/não encontrada|404|could not be found/i).first()).toBeVisible();
  });

  test("F3-E1 pela conversa, mesmo com o teste vencido, pedir uma pessoa abre chamado", async ({ page, user }) => {
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", user.id);
    await login(page, user);
    const box = page.getByLabel("Mensagem para o assistente");
    await box.fill("quero falar com uma pessoa, fui cobrado duas vezes");
    await box.press("Enter");
    await expect(page.getByText(/Chamei uma pessoa do time\. Protocolo CL-[A-Z2-9]{6}/)).toBeVisible();
    const { data } = await admin.from("support_tickets").select("channel, status").eq("user_id", user.id);
    expect(data).toEqual([{ channel: "web", status: "open" }]);
  });
});

void createUser;
