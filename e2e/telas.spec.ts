import { a11y, expect, login, noHorizontalScroll, test } from "./fixtures";

// Todas as telas com uma conta nova: abrem sem erro, passam na varredura de acessibilidade
// e não rolam para o lado no celular.
export const SCREENS = [
  "/conversa", "/conversa/voz", "/dia", "/dia/calendario", "/agenda", "/tarefas", "/lembretes", "/habitos", "/foco",
  "/projetos", "/metas", "/notas", "/dinheiro", "/dinheiro/extrato", "/dinheiro/contas", "/dinheiro/fixos",
  "/dinheiro/variaveis", "/dinheiro/parcelas", "/dinheiro/analise", "/dinheiro/categorias", "/saude", "/saude/treino",
  "/saude/dieta", "/saude/progresso", "/automacoes", "/avisos", "/briefing", "/mais", "/ajustes", "/ajustes/assistente", "/ajustes/suporte",
];

test("X-H1 todas as telas abrem, sem violações de acessibilidade @celular", async ({ page, user }) => {
  test.setTimeout(240_000);
  await login(page, user);
  for (const path of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect.soft(page.url(), `${path} não redireciona`).toContain(path);
    expect.soft(await page.getByRole("heading", { level: 1 }).count(), `${path} tem um título h1`).toBeGreaterThan(0);
    expect.soft(await a11y(page), `acessibilidade em ${path}`).toEqual([]);
    expect.soft(await noHorizontalScroll(page), `${path} sem rolagem para o lado`).toBe(true);
  }
});

test("X-H2 telas públicas: entrar e planos", async ({ page }) => {
  for (const path of ["/entrar", "/planos"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect.soft(await a11y(page), `acessibilidade em ${path}`).toEqual([]);
  }
});
