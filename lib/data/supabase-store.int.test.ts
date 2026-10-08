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

  it("um segundo usuário não vê nem altera nada do primeiro", async () => {
    expect(await b.listTasks()).toEqual([]);
    expect(await b.listHabitLogs()).toEqual([]);
    expect(await b.listMessages()).toEqual([]);
    const task = (await a.listTasks())[0];
    expect(await b.updateTask(task.id, { title: "invadido" })).toBeNull();
    const habit = (await a.listHabits())[0];
    expect(await b.setHabitDone(habit.id, "2026-10-08", true)).toBe(false);
    // e pelo navegador (chave pública + sessão de B), o RLS só devolve as linhas de B
    const browser = createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });
    await browser.auth.signInWithPassword({ email: `b-${stamp}@teste.local`, password });
    const { data } = await browser.from("tasks").select("id");
    expect(data).toEqual([]);
    const { error } = await browser.from("tasks").insert({ user_id: users[1], title: "direto do navegador" });
    expect(error).not.toBeNull();  // escrita só pelo servidor
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
