import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Peças comuns dos testes de ponta a ponta: usuário novo por teste (apagado no fim),
// login pela tela, falha em erro de console ou resposta 5xx, e varredura de acessibilidade.
export const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
export const MOCK = "http://127.0.0.1:4010";
export const PASSWORD = "senha-boa-12345";

export type TestUser = { id: string; email: string; name: string };

export async function createUser(name = "Lia"): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemplo.com.br`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  await markOnboarded(data.user!.id);
  return { id: data.user!.id, email, name };
}

// A configuração inicial tem teste próprio (e2e/navegacao.spec.ts); nos outros, já passou
export async function markOnboarded(userId: string) {
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("user_id", userId);
}

export async function login(page: Page, user: TestUser, path = "/conversa") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await page.waitForURL(/\/(conversa|ajustes\/plano)(\?|$)/);  // sem plano, a entrada já cai na tela do plano
  if (path !== "/conversa") {
    await page.waitForLoadState("networkidle");  // a conversa ainda carrega: navegar agora aborta a página
    await page.goto(path);
  }
  await page.waitForLoadState("networkidle");  // só mexe depois da hidratação
}

// Time: abre Administração pelo menu da conta (funciona no celular e no computador)
export async function openAdmin(page: Page) {
  await page.getByRole("button", { name: "Sua conta" }).click();
  await page.locator("#menu-conta").getByRole("link", { name: "Administração" }).click();
  await page.getByRole("heading", { name: "Administração" }).waitFor();
}

export async function mockCalls(): Promise<Array<{ method: string; url: string; body: Record<string, unknown> }>> {
  return (await fetch(`${MOCK}/__calls`)).json();
}

// Acessibilidade WCAG 2.1 A e AA. Devolve a lista legível para a mensagem do teste falhar clara.
export async function a11y(page: Page) {
  // meta-viewport desligada de propósito: o app trava o zoom para parecer um app (decisão do dono, ver build-log)
  const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).disableRules(["meta-viewport"]).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

type Fixtures = { user: TestUser; allowConsole: RegExp[]; guard: void };

// Tela de pagamento do app (/assinar/<plano>): escolhe a forma, preenche e envia. Devolve o id da cobrança ou da assinatura criada.
export const PAYER = { name: "Maria da Silva", cpf: "529.982.247-25", phone: "(11) 91234-5678", cep: "01310-100", number: "100" };
export const CARD = { number: "4111 1111 1111 1111", refused: "4000 0000 0000 0002", holder: "MARIA DA SILVA", expiry: "12/30", cvv: "123" };
export async function fillPayment(page: Page, method: "Pix" | "Boleto" | "Cartão de crédito", opts: { card?: string } = {}) {
  await page.getByRole("radio", { name: new RegExp(`^${method}`) }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome completo").fill(PAYER.name);
  await page.getByLabel("CPF ou CNPJ").fill(PAYER.cpf);
  await page.getByLabel("Celular").fill(PAYER.phone);
  if (method === "Cartão de crédito") {
    await page.getByLabel("Número do cartão").fill(opts.card ?? CARD.number);
    await page.getByLabel("Nome no cartão").fill(CARD.holder);
    await page.getByLabel("Validade (MM/AA)").fill(CARD.expiry);
    await page.getByLabel("Código de segurança").fill(CARD.cvv);
    await page.getByLabel("CEP").fill(PAYER.cep);
    await page.getByLabel("Número do endereço").fill(PAYER.number);
  }
  await page.getByRole("button", { name: method === "Pix" ? /Gerar Pix/ : method === "Boleto" ? /Gerar boleto/ : /Pagar com cartão/ }).click();
}
export async function lastAttempt(userId: string) {
  const { data } = await admin.from("checkout_sessions").select("id, status, method, kind, failure").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
  return data!;
}
export async function pay(page: Page, user: TestUser, plan: string, method: "Pix" | "Boleto" | "Cartão de crédito", opts: { card?: string } = {}) {
  await page.goto(`/assinar/${plan}`, { waitUntil: "networkidle" });
  await fillPayment(page, method, opts);
  await expect.poll(async () => (await lastAttempt(user.id).catch(() => null))?.id ?? "").not.toBe("");
  return (await lastAttempt(user.id)).id;
}

export const test = base.extend<Fixtures>({
  allowConsole: [[], { option: true }],
  user: async ({}, provide) => {
    const u = await createUser();
    await provide(u);
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  },
  guard: [async ({ page, allowConsole }, provide) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (allowConsole.some((r) => r.test(text))) return;
      problems.push(`console: ${text}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} em ${r.url()}`); });
    await provide();
    expect(problems, "erros de console ou respostas 5xx").toEqual([]);
  }, { auto: true }],
});

export { expect };
