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
  return { id: data.user!.id, email, name };
}

export async function login(page: Page, user: TestUser, path = "/conversa") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await page.waitForURL("**/conversa");
  if (path !== "/conversa") await page.goto(path);
  await page.waitForLoadState("networkidle");  // só mexe depois da hidratação
}

export async function mockCalls(): Promise<Array<{ method: string; url: string; body: Record<string, unknown> }>> {
  return (await fetch(`${MOCK}/__calls`)).json();
}

// Acessibilidade WCAG 2.1 A e AA. Devolve a lista legível para a mensagem do teste falhar clara.
export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

type Fixtures = { user: TestUser; allowConsole: RegExp[]; guard: void };

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
