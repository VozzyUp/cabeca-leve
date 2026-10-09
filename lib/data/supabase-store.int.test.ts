import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { DataStore } from "./store";
import { createSupabaseStore } from "./supabase-store";

// Teste de integração contra o Supabase local (npx supabase start). Roda com:
// SUPABASE_TEST=1 npx vitest run lib/data/supabase-store.int.test.ts
const URL = "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? (process.env.SUPABASE_SECRET_KEY ?? "");
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("SupabaseStore", () => {
  const admin = createClient<Database>(URL, SECRET, { auth: { persistSession: false } });
  const users: string[] = [];
  let a: DataStore, b: DataStore;
  const password = "senha-de-teste-123";
  const stamp = Date.now();

  beforeAll(async () => {
    for (const who of ["a", "b"]) {
      const { data, error } = await admin.auth.admin.createUser({ email: `${who}-${stamp}@teste.local`, password, email_confirm: true, user_metadata: { name: who.toUpperCase() } });
      if (error) throw error;
      users.push(data.user.id);
    }
    a = await createSupabaseStore(admin, users[0], `a-${stamp}@teste.local`);
    b = await createSupabaseStore(admin, users[1], `b-${stamp}@teste.local`);
  });
  afterAll(async () => {
    const { error } = await admin.auth.admin.deleteUser(users[0]);
    expect(error).toBeNull();
  });

  it("cadastro cria perfil, categorias, conta e aviso de boas-vindas", async () => {
    const s = await a.getSettings();
    expect(s.name).toBe("A");
    expect(s.plan).toBe("trial");
    expect((await a.listCategories()).length).toBe(14);
    expect((await a.listAccounts())[0].name).toBe("Conta corrente");
    expect((await a.listNotices())[0].title).toBe("Bem-vindo");
  });

  it("escreve e lê tarefas, hábitos, gastos e lembretes", async () => {
    const t = await a.createTask({ title: "Ligar para o banco", dueOn: "2026-10-08" });
    await a.updateTask(t.id, { status: "done" });
    expect((await a.listTasks()).find((x) => x.id === t.id)?.completedAt).toBeTruthy();
    const h = await a.createHabit({ name: "Ler", time: "21:00" });
    expect(await a.setHabitDone(h.id, "2026-10-07", true)).toBe(true);
    expect(await a.setHabitDone(h.id, "2026-10-07", true)).toBe(true);  // repetido não duplica
    expect((await a.listHabitLogs()).filter((l) => l.habitId === h.id)).toHaveLength(1);
    const cat = (await a.listCategories()).find((c) => c.name === "Alimentação")!;
    await a.createTransaction({ type: "expense", amountCents: 3500, occurredOn: "2026-10-07", description: "Padaria", categoryId: cat.id,
      accountId: "", paymentMethod: "pix", source: "chat" });
    expect((await a.listAccounts())[0].balanceCents).toBe(-3500);
    const r = await a.createReminder({ title: "Mercado", nextFireAt: "2026-10-07T21:00:00Z" });
    const action = await a.recordAction("reminder", r.id);
    await a.appendMessage({ role: "assistant", text: "Feito", cards: [{ actionId: action.id, kind: "reminder", title: "Mercado", value: "18:00", valueTone: "neutral", meta: "", href: "/lembretes", undone: false }] });
    expect(await a.undoAction(action.id)).toEqual({ ok: true });
    expect(await a.undoAction(action.id)).toEqual({ ok: false, reason: "already_undone" });
    expect((await a.listReminders()).some((x) => x.id === r.id)).toBe(false);
    expect((await a.listMessages()).at(-1)?.cards[0].undone).toBe(true);
  });

  it("ficha e plano alimentar novos trocam os atuais; desfazer devolve os de antes; projeto, meta e revisão se desfazem", async () => {
    const plan = (name: string) => ({ name, sessions: [{ name: `Treino ${name}`, weekdays: [1], exercises: [{ name: "Supino", sets: 4, reps: 10, loadKg: 40, restSeconds: 90 }] }] });
    const a1 = await a.createWorkoutPlan(plan("1"));
    expect(a1.replaced).toEqual([]);
    const a2 = await a.createWorkoutPlan(plan("2"));
    expect(a2.replaced).toEqual([a1.id]);
    expect((await a.listWorkouts()).map((w) => w.name)).toEqual(["Treino 2"]);
    const act = await a.recordAction("workout_plan", a2.id, a2.replaced);
    expect(await a.undoAction(act.id)).toEqual({ ok: true });
    expect((await a.listWorkouts()).map((w) => w.name)).toEqual(["Treino 1"]);
    // a ficha de outra conta não aparece nem some
    expect((await b.listWorkouts()).map((w) => w.name)).not.toContain("Treino 1");

    const meal = (name: string) => ({ name, kcalTraining: 2400, kcalRest: null, proteinG: 150, carbsG: null, fatG: null, meals: [{ name: "Almoço", time: "12:30", items: ["arroz", "feijão"], kcal: 700 }] });
    const m1 = await a.createMealPlan(meal("Plano 1"));
    const m2 = await a.createMealPlan(meal("Plano 2"));
    expect(m2.replaced).toEqual([m1.id]);
    expect((await a.listMeals()).map((m) => m.items)).toEqual([["arroz", "feijão"]]);
    await a.undoAction((await a.recordAction("meal_plan", m2.id, m2.replaced)).id);
    expect(await a.listMeals()).toHaveLength(1);

    const project = await a.createProject({ name: "Reforma", description: "", startsOn: null, dueOn: "2026-12-01", milestones: [{ title: "Orçar", dueOn: null }, { title: "Contratar", dueOn: "2026-11-01" }] });
    expect(project.milestones.map((x) => x.title)).toEqual(["Orçar", "Contratar"]);
    await a.undoAction((await a.recordAction("project", project.id)).id);
    expect((await a.listProjects()).some((x) => x.id === project.id)).toBe(false);

    const goal = await a.createGoal({ title: "Viagem", unit: "money", targetValue: 500_000, monthlyPlan: 50_000, dueOn: "2026-12-31" });
    expect(goal).toMatchObject({ unit: "money", targetValue: 500_000 });
    expect((await a.addGoalProgress(goal.id, 120_000))!.currentValue).toBe(120_000);
    const count = await a.createGoal({ title: "Ler", unit: "count", targetValue: 12, monthlyPlan: null, dueOn: null });
    expect(count).toMatchObject({ unit: "count", targetValue: 12 });
    expect(await a.removeItem("goal", goal.id)).toBe(true);
    expect((await a.listGoals()).some((x) => x.id === goal.id)).toBe(false);
    expect(await a.removeItem("goal", goal.id)).toBe(false);  // já arquivada
    expect(await b.removeItem("goal", count.id)).toBe(false);  // de outra conta

    const auto = await a.createAutomation({ title: "Semana", prompt: "Resumo da semana", schedule: "weekly", weekdays: [0], runOn: null, time: "19:00", channel: "push", sources: ["tasks", "finance"], lookbackDays: 7 });
    expect(auto).toMatchObject({ schedule: "weekly", weekdays: [0], time: "19:00", active: true });
    const { data: row } = await admin.from("automations").select("next_run_at, sources").eq("id", auto.id).single();
    expect(new Date(row!.next_run_at!).getTime()).toBeGreaterThan(Date.now());
    expect(row!.sources).toEqual(["tasks", "finance"]);
    // pausada e religada depois de muito tempo: o próximo horário volta a valer de agora em diante
    await a.setAutomationActive(auto.id, false);
    await admin.from("automations").update({ next_run_at: new Date(Date.now() - 5 * 86_400_000).toISOString() }).eq("id", auto.id);
    expect(await a.setAutomationActive(auto.id, true)).toBe(true);
    const { data: relit } = await admin.from("automations").select("next_run_at, active").eq("id", auto.id).single();
    expect(relit!.active).toBe(true);
    expect(new Date(relit!.next_run_at!).getTime()).toBeGreaterThan(Date.now());
    await a.undoAction((await a.recordAction("automation", auto.id)).id);
    expect(await a.listAutomations()).toEqual([]);

    // fichas e planos: remover tira da tela sem apagar o histórico
    const w = await a.createWorkoutPlan(plan("3"));
    const sessionId = (await a.listWorkouts())[0].id;
    expect(await a.removeItem("workout", sessionId)).toBe(true);
    expect(await a.listWorkouts()).toEqual([]);
    expect(w.id).toBeTruthy();
  });

  it("contas fixas: cadastra, só conta vencimento de agora em diante, confirma uma vez só (mesmo com dois toques juntos) e desfaz", async () => {
    const { confirmBill, createRecurring } = await import("@/lib/assistant/tools");
    const { toResolve } = await import("@/lib/domain/resolve");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const day = Number(today.slice(8, 10));
    const past = day > 2 ? day - 1 : 1;  // um dia que já passou neste mês (ou o dia 1)
    const rent = await createRecurring(a, { kind: "bill", description: "Aluguel", amountCents: 180_000, dayOfMonth: past, categoryId: null, paymentMethod: "pix", fromThisMonth: false });
    expect(rent).toMatchObject({ kind: "recurring", title: "Aluguel", valueTone: "expense" });
    const fixed = (await a.listRecurrences()).find((r) => r.description === "Aluguel")!;
    expect(fixed).toMatchObject({ dayOfMonth: past, amountCents: 180_000, active: true });
    // cadastrado hoje: o vencimento que já passou não aparece como atrasado
    expect(toResolve(await a.listRecurrences(), await a.listTransactions(), today).some((p) => p.description === "Aluguel" && p.status === "late")).toBe(false);

    // "este mês ainda em aberto": o vencimento que passou conta como atrasado
    const light = await createRecurring(a, { kind: "bill", description: "Luz", amountCents: 20_000, dayOfMonth: past, categoryId: null, paymentMethod: null, fromThisMonth: true });
    expect(light.meta).toContain("este mês ainda em aberto");
    const lightId = (await a.listRecurrences()).find((r) => r.description === "Luz")!.id;
    const late = toResolve(await a.listRecurrences(), await a.listTransactions(), today).find((p) => p.recurrenceId === lightId)!;
    expect(late).toMatchObject({ status: "late", dueOn: `${today.slice(0, 7)}-${String(past).padStart(2, "0")}` });

    // dois toques juntos em "paguei": um lançamento só
    const [r1, r2] = await Promise.all([confirmBill(a, lightId, late.dueOn, now), confirmBill(a, lightId, late.dueOn, now)]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    const failed = [r1, r2].find((r) => !r.ok)!;
    expect(failed).toMatchObject({ ok: false, text: expect.stringMatching(/já (estava confirmada|está resolvida)/) });
    const okRes = [r1, r2].find((r) => r.ok)! as Extract<typeof r1, { ok: true }>;
    expect(okRes.card).toMatchObject({ kind: "transaction", title: "Luz", href: "/dinheiro/extrato" });
    const txs = (await a.listTransactions()).filter((t) => t.recurrenceId === lightId);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: "expense", amountCents: 20_000, occurredOn: late.dueOn });
    expect(toResolve(await a.listRecurrences(), await a.listTransactions(), today).some((p) => p.recurrenceId === lightId)).toBe(false);
    expect(await confirmBill(a, lightId, null, now)).toMatchObject({ ok: false });

    // desfazer o lançamento reabre a conta; confirmar a conta de outra pessoa não funciona
    await a.undoAction(okRes.card.actionId);
    expect(toResolve(await a.listRecurrences(), await a.listTransactions(), today).some((p) => p.recurrenceId === lightId)).toBe(true);
    expect(await confirmBill(b, lightId, null, now)).toEqual({ ok: false, text: "Não achei essa conta fixa." });

    // desfazer o cadastro e remover
    await a.undoAction((await a.recordAction("recurrence", fixed.id)).id);
    expect((await a.listRecurrences()).some((r) => r.id === fixed.id)).toBe(false);
    expect(await a.removeItem("recurring", lightId)).toBe(true);
    expect(await a.removeItem("recurring", lightId)).toBe(false);
  });

  it("memória: guarda, não repete, respeita o limite, esquece um ou todos e é de cada conta", async () => {
    const first = await a.addMemory("Recebe o salário no dia 5");
    expect(first).toMatchObject({ ok: true, memory: { fact: "Recebe o salário no dia 5" } });
    expect(await a.addMemory("  recebe o SALÁRIO no dia 5. ")).toEqual({ ok: false, reason: "duplicate" });  // mesmo fato, outra escrita
    await a.addMemory("É vegetariana");
    expect((await a.listMemories()).map((m) => m.fact)).toEqual(["É vegetariana", "Recebe o salário no dia 5"]);  // o mais novo primeiro
    expect(await b.listMemories()).toEqual([]);
    const mine = (await a.listMemories())[0];
    expect(await b.removeItem("memory", mine.id)).toBe(false);  // de outra conta
    expect(await a.removeItem("memory", mine.id)).toBe(true);
    expect(await a.removeItem("memory", mine.id)).toBe(false);
    expect(await a.clearMemories()).toBe(1);
    expect(await a.listMemories()).toEqual([]);
    for (let i = 0; i < 100; i++) expect((await a.addMemory(`Fato número ${i}`)).ok).toBe(true);
    expect(await a.addMemory("Mais um")).toEqual({ ok: false, reason: "full" });
    expect(await a.clearMemories()).toBe(100);
    // só o servidor lê: a chave pública e quem está logado não enxergam a tabela dos outros
    await a.addMemory("Segredo da conta A");
    const logged = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
    await logged.auth.signInWithPassword({ email: `b-${stamp}@teste.local`, password });
    expect(((await logged.from("memories").select("fact")).data ?? [])).toEqual([]);
    await a.clearMemories();
  });

  it("custo da IA: grava por modelo, soma no período e só o servidor enxerga", async () => {
    await a.recordAiUsage([
      { model: "claude-sonnet-5-5", calls: 2, inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 10 },
      { model: "claude-opus-5-5", calls: 1, inputTokens: 5, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
    ]);  // uma mensagem respondida por dois modelos (reserva automática)
    await a.recordAiUsage([{ model: "claude-sonnet-5-5", calls: 3, inputTokens: 200, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 5 }]);
    const { data, error } = await admin.rpc("admin_ai_usage", { p_from: new Date(Date.now() - 3_600_000).toISOString(), p_to: new Date(Date.now() + 60_000).toISOString() });
    expect(error).toBeNull();
    const mine = (data ?? []).filter((r) => r.user_id === users[0]);
    const sonnet = mine.find((r) => r.model === "claude-sonnet-5-5")!;
    expect(sonnet).toMatchObject({ turns: 2, calls: 5, input_tokens: 300, output_tokens: 50, cache_read_tokens: 50, cache_write_tokens: 15 });
    expect(mine.find((r) => r.model === "claude-opus-5-5")).toMatchObject({ turns: 1, calls: 1 });
    // período vazio não devolve nada
    const old = await admin.rpc("admin_ai_usage", { p_from: "2020-01-01T00:00:00Z", p_to: "2020-01-02T00:00:00Z" });
    expect((old.data ?? []).filter((r) => r.user_id === users[0])).toEqual([]);
    // quem usa a chave pública (ou está logado) não lê a tabela nem chama a função
    const anon = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
    expect((await anon.from("ai_usage").select("id")).error).not.toBeNull();
    expect((await anon.rpc("admin_ai_usage", { p_from: "2020-01-01T00:00:00Z", p_to: "2030-01-01T00:00:00Z" })).error).not.toBeNull();
    const logged = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
    await logged.auth.signInWithPassword({ email: `a-${stamp}@teste.local`, password });
    expect((await logged.from("ai_usage").select("id")).error).not.toBeNull();
  });

  it("concluir e reabrir um lembrete funciona, também o que repete e o concluído sem data", async () => {
    const weekly = await a.createReminder({ title: "Terapia", nextFireAt: "2026-10-07T13:30:00Z", recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE" });
    const done = await a.updateReminder(weekly.id, { status: "done" });
    expect(done?.status).toBe("done");
    expect(done?.nextFireAt).toBe("2026-10-07T13:30:00+00:00");  // a data fica guardada
    const reopened = await a.updateReminder(weekly.id, { status: "active" });
    expect(reopened?.status).toBe("active");
    expect(new Date(reopened!.nextFireAt!).getTime()).toBeGreaterThan(Date.now());
    // concluído antes de guardarmos a data (sem data): reabre com uma nova
    const old = await a.createReminder({ title: "Antigo", nextFireAt: "2026-10-07T13:30:00Z" });
    await admin.from("reminders").update({ status: "done", next_fire_at: null }).eq("id", old.id);
    const back = await a.updateReminder(old.id, { status: "active" });
    expect(back?.status).toBe("active");
    expect(back?.nextFireAt).not.toBeNull();
    await a.deleteReminder(weekly.id); await a.deleteReminder(old.id);
  });

  it("tarefa recorrente: concluir cria a próxima, uma vez só", async () => {
    const t = await a.createTask({ title: "Pagar a diarista", dueOn: "2026-10-09", recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR", notes: "R$ 150 no Pix" });
    await a.updateTask(t.id, { status: "done" });
    await a.updateTask(t.id, { status: "todo" });
    await a.updateTask(t.id, { status: "done" });  // concluir de novo não duplica
    const next = (await a.listTasks()).filter((x) => x.recurrenceSourceId === t.id);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ dueOn: "2026-10-16", status: "todo", notes: "R$ 150 no Pix", recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
  });

  it("editar e apagar tarefa, lembrete e lançamento; subcategorias", async () => {
    const t = await a.createTask({ title: "Rascunho", dueOn: null });
    expect((await a.updateTask(t.id, { notes: "detalhe" }))?.notes).toBe("detalhe");
    expect(await a.deleteTask(t.id)).toBe(true);
    expect(await a.deleteTask(t.id)).toBe(false);
    const r = await a.createReminder({ title: "Apagar", nextFireAt: "2026-12-01T12:00:00Z" });
    expect(await a.deleteReminder(r.id)).toBe(true);
    const tx = (await a.listTransactions())[0];
    expect((await a.updateTransaction(tx.id, { amountCents: 4200, description: "Padaria do bairro" }))?.amountCents).toBe(4200);
    const parent = (await a.listCategories()).find((c) => c.name === "Alimentação")!;
    const sub = await a.createCategory({ name: "Padaria", kind: "income", parentId: parent.id });
    expect(sub).toMatchObject({ kind: "expense", parentId: parent.id });  // herda o tipo da de cima
    expect((await a.updateCategory(sub.id, { name: "Padarias" }))?.name).toBe("Padarias");
    expect(await a.archiveCategory(parent.id)).toBe(true);  // arquiva junto as de baixo
    expect((await a.listCategories()).some((c) => c.id === parent.id || c.id === sub.id)).toBe(false);
    expect((await a.listTransactions()).find((x) => x.id === tx.id)?.categoryId).toBe(parent.id);  // lançamento antigo mantém
    expect(await a.deleteTransaction(tx.id)).toBe(true);
  });

  it("um segundo usuário não vê nem altera nada do primeiro", async () => {
    expect(await b.listTasks()).toEqual([]);
    expect(await b.listHabitLogs()).toEqual([]);
    expect(await b.listMessages()).toEqual([]);
    const task = (await a.listTasks())[0];
    expect(await b.updateTask(task.id, { title: "invadido" })).toBeNull();
    const habit = (await a.listHabits())[0];
    expect(await b.setHabitDone(habit.id, "2026-10-08", true)).toBe(false);
    expect(await b.deleteTask(task.id)).toBe(false);
    expect(await b.archiveHabit(habit.id)).toBe(false);
    const cat = (await a.listCategories())[0];
    expect(await b.archiveCategory(cat.id)).toBe(false);
    await expect(b.createCategory({ name: "Invasora", kind: "expense", parentId: cat.id })).rejects.toThrow();
    // e pelo navegador (chave pública + sessão de B), o RLS só devolve as linhas de B
    const browser = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
    await browser.auth.signInWithPassword({ email: `b-${stamp}@teste.local`, password });
    const { data } = await browser.from("tasks").select("id");
    expect(data).toEqual([]);
    const { error } = await browser.from("tasks").insert({ user_id: users[1], title: "direto do navegador" });
    expect(error).not.toBeNull();  // escrita só pelo servidor
  });

  it("mensagens que chegam juntas: todas gravadas com posições seguidas, e um turno por vez", async () => {
    await Promise.all(Array.from({ length: 15 }, (_, i) => a.appendMessage({ role: "user", text: `rajada ${i}`, cards: [] })));
    const { data } = await admin.from("messages").select("seq, text_preview").eq("user_id", users[0]).order("seq");
    expect(data!.filter((m) => m.text_preview?.startsWith("rajada"))).toHaveLength(15);
    expect(data!.map((m) => m.seq)).toEqual(data!.map((_, i) => i));
    const order: string[] = [];
    await Promise.all([1, 2, 3].map((n) => a.withTurn(async () => {
      order.push(`entra ${n}`);
      await new Promise((r) => setTimeout(r, 150));
      order.push(`sai ${n}`);
    })));
    for (let i = 0; i < order.length; i += 2) expect(order[i + 1]).toBe(order[i].replace("entra", "sai"));
    // um turno que falha solta a vez
    await expect(a.withTurn(async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");
    expect(await a.withTurn(async () => "livre")).toBe("livre");
  });

  it("a conversa mostra as 500 mensagens mais recentes, não as mais antigas", async () => {
    const { data: conv } = await admin.from("conversations").select("id").eq("user_id", users[1]).order("local_date").limit(1).maybeSingle();
    const conversationId = conv?.id ?? (await admin.from("conversations").insert({ user_id: users[1], local_date: "2026-01-01" }).select("id").single()).data!.id;
    const { data: last } = await admin.from("messages").select("seq").eq("conversation_id", conversationId).order("seq", { ascending: false }).limit(1);
    const start = (last?.[0]?.seq ?? -1) + 1;
    const base = Date.parse("2026-01-01T12:00:00Z");
    const rows = Array.from({ length: 520 }, (_, i) => ({
      user_id: users[1], conversation_id: conversationId, seq: start + i, role: "user", channel: "web", content: [{ type: "text", text: `antiga ${i}` }],
      text_preview: `antiga ${i}`, created_at: new Date(base + i * 1000).toISOString(),
    }));
    expect((await admin.from("messages").insert(rows)).error).toBeNull();
    await b.appendMessage({ role: "user", text: "a mais nova", cards: [] });
    const list = await b.listMessages();
    expect(list.at(-1)!.text).toBe("a mais nova");
    expect(list.length).toBeLessThanOrEqual(500);
  });

  it("excluir a conta apaga tudo em cascata, inclusive conversa e notas", async () => {
    await b.createTask({ title: "Temporária", dueOn: null });
    await b.appendMessage({ role: "user", text: "oi", cards: [] });
    await b.createNote({ title: "Ideia", body: "texto", notebook: "Pessoal", kind: "note" });
    await b.deleteAllData();
    const { data } = await admin.from("tasks").select("id").eq("user_id", users[1]);
    expect(data).toEqual([]);
  });
});
