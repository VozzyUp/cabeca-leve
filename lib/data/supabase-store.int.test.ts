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
