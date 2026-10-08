import { admin, expect, login, mockCalls, test } from "./fixtures";

// F04: o lembrete chega na hora certa (varredura de cada minuto → push e WhatsApp → Avisos)
const sweep = (secret = "dev-cron-secret") => fetch("http://localhost:3000/api/cron/sweep", { headers: { authorization: `Bearer ${secret}` } });
const linkWhatsApp = async (userId: string, number: string) =>
  admin.from("channel_links").insert({ user_id: userId, channel: "whatsapp", external_id: `+${number}`, verified_at: new Date().toISOString() });

test.describe("F04 lembretes", () => {
  test("F04-H1 lembrete vencido sai pelo WhatsApp uma vez só e fica em Avisos", async ({ page, user }) => {
    const number = `55119${String(Date.now()).slice(-8)}`;
    await linkWhatsApp(user.id, number);
    await login(page, user, "/lembretes");
    const r = await page.request.post("/api/reminders", { data: { title: "Tomar o remédio", nextFireAt: new Date(Date.now() + 2000).toISOString(), recurrenceRule: null } });
    expect(r.status()).toBe(201);
    await new Promise((res) => setTimeout(res, 2500));
    expect((await sweep()).status).toBe(200);
    await sweep();  // duas varreduras seguidas não mandam em dobro
    const sent = (await mockCalls()).filter((c) => c.url === "/send/text" && String(c.body.number) === number);
    expect(sent.map((c) => c.body.text)).toEqual([expect.stringMatching(/⏰ Lembrete: Tomar o remédio/)]);
    await page.goto("/avisos");
    await expect(page.getByText(/Tomar o remédio/).first()).toBeVisible();
  });

  test("F04-E1 lembrete diário continua ativo e vai para o dia seguinte", async ({ page, user }) => {
    await login(page, user, "/lembretes");
    const at = new Date(Date.now() + 1500);
    const { reminder } = await (await page.request.post("/api/reminders", { data: { title: "Beber água", nextFireAt: at.toISOString(), recurrenceRule: "FREQ=DAILY" } })).json();
    await new Promise((res) => setTimeout(res, 2000));
    await sweep();
    const { data } = await admin.from("reminders").select("status, next_fire_at").eq("id", reminder.id).single();
    expect(data!.status).toBe("active");
    const next = new Date(data!.next_fire_at!).getTime();
    expect(Math.round((next - at.getTime()) / 3_600_000)).toBe(24);
  });

  test("F04-E2 horário mostrado no fuso da conta, mesmo com o aparelho em outro fuso", async ({ browser, user }) => {
    const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "Asia/Tokyo" });
    const page = await ctx.newPage();
    await login(page, user, "/lembretes");
    // 8h de amanhã em São Paulo (UTC−3) = 11:00 UTC
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.request.post("/api/reminders", { data: { title: "Reunião cedo", nextFireAt: `${tomorrow}T11:00:00.000Z`, recurrenceRule: null } });
    await page.reload();
    await expect(page.getByText("Reunião cedo")).toBeVisible();
    await expect(page.getByText(/08:00/).first()).toBeVisible();
    await ctx.close();
  });

  test("F04-E3 criar pela tela com dia e hora, e apagar", async ({ page, user }) => {
    await login(page, user, "/lembretes");
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 86_400_000));
    await page.getByLabel("Novo lembrete").fill("Levar o carro na revisão");
    await page.getByLabel("Dia", { exact: true }).fill(day);
    await page.getByLabel("Hora", { exact: true }).fill("09:30");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByText("Levar o carro na revisão")).toBeVisible();
    await page.getByRole("button", { name: /Apagar Levar o carro/ }).click();
    await expect(page.getByText("Levar o carro na revisão")).toHaveCount(0);
  });

  test("F04-N1 varredura sem o segredo é recusada", async () => {
    expect((await sweep("errado")).status).toBe(401);
  });
});
