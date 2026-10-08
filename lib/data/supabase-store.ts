import type { Admin } from "@/lib/supabase/server";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { nextDate, nextFireAt } from "@/lib/domain/recurrence";
import { newProtocol, notifyOwner, supportDueAt } from "@/lib/support";
import { addDays, localDate, zonedToUtc } from "@/lib/time";
import type { DataStore } from "./store";
import type {
  ActionCardData, ActionRecord, BodyMeasurement, CalendarEvent, ChatMessage, Note, Reminder, Settings, Task, Transaction,
  SupportTicket,
  Budget,
} from "./types";

// DataStore sobre o Supabase. Usa o cliente de serviço e filtra TODA consulta por user_id:
// é a segunda barreira, depois das FKs compostas do esquema (que impedem apontar para
// registro de outro usuário). As telas não sabem qual implementação está por trás.

type Result<T> = { data: T; error: { message: string } | null };
// campos opcionais das funções do banco: o gerador de tipos não marca como anuláveis
const opt = <T,>(v: T | null | undefined) => (v ?? null) as T;
function must<T>(r: Result<T>): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}

const ENTITY_TABLE = { reminder: "reminders", transaction: "transactions", task: "tasks", habit: "habits" } as const;
const TABLE_ENTITY = Object.fromEntries(Object.entries(ENTITY_TABLE).map(([k, v]) => [v, k])) as Record<string, ActionRecord["entity"]>;
const UI_METHODS = new Set(["pix", "debit", "credit", "cash", "other"]);
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

export async function createSupabaseStore(db: Admin, userId: string, email: string | null): Promise<DataStore> {
  const profile = must(await db.from("profiles").select("timezone").eq("user_id", userId).single());
  const tz = profile.timezone;
  const today = () => localDate(new Date(), tz);
  const noonUtc = (day: string) => { const [y, m, d] = day.split("-").map(Number); return zonedToUtc(y, m, d, 12, 0, tz).toISOString(); };
  // intervalo UTC de um dia local
  const dayRange = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    const [y2, m2, d2] = addDays(day, 1).split("-").map(Number);
    return [zonedToUtc(y, m, d, 0, 0, tz).toISOString(), zonedToUtc(y2, m2, d2, 0, 0, tz).toISOString()] as const;
  };

  const mapReminder = (r: { id: string; title: string; next_fire_at: string | null; recurrence_rule: string | null; channels: string[]; status: string; last_fired_at: string | null; created_at: string }): Reminder => ({
    id: r.id, title: r.title, nextFireAt: r.next_fire_at, recurrenceRule: r.recurrence_rule,
    channels: r.channels as Reminder["channels"], status: r.status as Reminder["status"], lastFiredAt: r.last_fired_at, createdAt: r.created_at,
  });
  const mapTask = (t: { id: string; title: string; due_on: string | null; priority: string; status: string; notes: string | null; recurrence_rule: string | null; recurrence_source_id: string | null; completed_at: string | null; created_at: string }): Task => ({
    id: t.id, title: t.title, dueOn: t.due_on, priority: t.priority as Task["priority"], status: t.status as Task["status"],
    notes: t.notes, recurrenceRule: t.recurrence_rule, recurrenceSourceId: t.recurrence_source_id, completedAt: t.completed_at, createdAt: t.created_at,
  });

  async function defaultAccountId() {
    const rows = must(await db.from("accounts").select("id").eq("user_id", userId).is("archived_at", null).order("created_at").limit(1));
    if (rows[0]) return rows[0].id;
    return must(await db.from("accounts").insert({ user_id: userId, name: "Conta corrente" }).select("id").single()).id;
  }

  async function todayConversation() {
    const day = today();
    const r = await db.from("conversations").upsert({ user_id: userId, local_date: day }, { onConflict: "user_id,local_date" }).select("id").single();
    return must(r).id;
  }

  async function notebookId(name: string) {
    const found = must(await db.from("notebooks").select("id").eq("user_id", userId).is("parent_id", null).eq("name", name).limit(1));
    if (found[0]) return found[0].id;
    return must(await db.from("notebooks").insert({ user_id: userId, name }).select("id").single()).id;
  }

  async function markCards(actionId: string) {
    const rows = must(await db.from("messages").select("id, cards").eq("user_id", userId).filter("cards", "cs", JSON.stringify([{ actionId }])));
    for (const m of rows) {
      const cards = (m.cards as ActionCardData[]).map((c) => (c.actionId === actionId ? { ...c, undone: true } : c));
      must(await db.from("messages").update({ cards: cards as unknown as Json[] }).eq("id", m.id).eq("user_id", userId));
    }
  }

  const store: DataStore = {
    timezone: () => tz,

    async listReminders() {
      const rows = must(await db.from("reminders").select("*").eq("user_id", userId).order("next_fire_at", { nullsFirst: false }));
      return rows.map(mapReminder);
    },
    async createReminder({ title, nextFireAt: at, channels = ["push"], recurrenceRule = null }) {
      return mapReminder(must(await db.from("reminders").insert({ user_id: userId, title, next_fire_at: at, channels, timezone: tz, recurrence_rule: recurrenceRule }).select("*").single()));
    },
    async updateReminder(id, patch) {
      const row: TablesUpdate<"reminders"> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.nextFireAt !== undefined) row.next_fire_at = patch.nextFireAt;
      if (patch.lastFiredAt !== undefined) row.last_fired_at = patch.lastFiredAt;
      if (patch.recurrenceRule !== undefined) row.recurrence_rule = patch.recurrenceRule;
      if (patch.status !== undefined) { row.status = patch.status; if (patch.status !== "active") row.next_fire_at = null; }
      // avisou um recorrente: já fica marcado para a próxima vez
      if (patch.lastFiredAt) {
        const cur = must(await db.from("reminders").select("recurrence_rule, next_fire_at, status").eq("id", id).eq("user_id", userId).maybeSingle() as Result<{ recurrence_rule: string | null; next_fire_at: string | null; status: string } | null>);
        const rule = patch.recurrenceRule ?? cur?.recurrence_rule;
        if (rule && cur?.next_fire_at && cur.status === "active") row.next_fire_at = nextFireAt(rule, cur.next_fire_at, tz, new Date(patch.lastFiredAt)) ?? cur.next_fire_at;
      }
      const r = await db.from("reminders").update(row).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
      const data = must(r as Result<Parameters<typeof mapReminder>[0] | null>);
      return data ? mapReminder(data) : null;
    },
    async deleteReminder(id) {
      return must(await db.from("reminders").delete().eq("id", id).eq("user_id", userId).select("id")).length > 0;
    },

    async listTasks() {
      const rows = must(await db.from("tasks").select("*").eq("user_id", userId).is("archived_at", null).is("parent_task_id", null).order("created_at"));
      return rows.map(mapTask);
    },
    async createTask({ title, dueOn, priority = "medium", notes = null, recurrenceRule = null }) {
      return mapTask(must(await db.from("tasks").insert({ user_id: userId, title, due_on: dueOn, priority, notes, recurrence_rule: recurrenceRule }).select("*").single()));
    },
    async updateTask(id, patch) {
      const row: TablesUpdate<"tasks"> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.dueOn !== undefined) row.due_on = patch.dueOn;
      if (patch.priority !== undefined) row.priority = patch.priority;
      if (patch.notes !== undefined) row.notes = patch.notes;
      if (patch.recurrenceRule !== undefined) row.recurrence_rule = patch.recurrenceRule;
      const before = must(await db.from("tasks").select("*").eq("id", id).eq("user_id", userId).maybeSingle() as Result<Parameters<typeof mapTask>[0] | null>);
      if (!before) return null;
      if (patch.status !== undefined) {
        row.status = patch.status;
        if (patch.status !== "done") row.completed_at = null;
        else {
          const cur = must(await db.from("tasks").select("completed_at").eq("id", id).eq("user_id", userId).maybeSingle() as Result<{ completed_at: string | null } | null>);
          row.completed_at = cur?.completed_at ?? new Date().toISOString();
        }
      }
      const data = must(await db.from("tasks").update(row).eq("id", id).eq("user_id", userId).select("*").maybeSingle() as Result<Parameters<typeof mapTask>[0] | null>);
      if (!data) return null;
      // concluiu uma recorrente: cria a próxima ocorrência (uma vez só)
      if (patch.status === "done" && before.status !== "done" && data.recurrence_rule) {
        const spawned = must(await db.from("tasks").select("id").eq("user_id", userId).eq("recurrence_source_id", id).limit(1));
        const base = data.due_on ?? today();
        const due = nextDate(data.recurrence_rule, base, base);
        if (!spawned.length && due) {
          must(await db.from("tasks").insert({ user_id: userId, title: data.title, notes: data.notes, priority: data.priority, due_on: due,
            recurrence_rule: data.recurrence_rule, recurrence_source_id: id }));
        }
      }
      return mapTask(data);
    },
    async deleteTask(id) {
      return must(await db.from("tasks").delete().eq("id", id).eq("user_id", userId).select("id")).length > 0;
    },

    async listHabits() {
      const rows = must(await db.from("habits").select("*").eq("user_id", userId).eq("active", true).is("archived_at", null).order("created_at"));
      return rows.map((h) => ({ id: h.id, name: h.name, weekdays: h.weekdays, time: hm(h.times[0]), active: h.active, createdAt: h.created_at }));
    },
    async createHabit({ name, weekdays = [0, 1, 2, 3, 4, 5, 6], time = null }) {
      const h = must(await db.from("habits").insert({ user_id: userId, name, weekdays, times: time ? [time] : [] }).select("*").single());
      return { id: h.id, name: h.name, weekdays: h.weekdays, time: hm(h.times[0]), active: h.active, createdAt: h.created_at };
    },
    async archiveHabit(id) {
      return must(await db.from("habits").update({ active: false, archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("id")).length > 0;
    },
    async listHabitLogs() {
      const rows = must(await db.from("habit_logs").select("habit_id, day").eq("user_id", userId));
      return rows.map((l) => ({ habitId: l.habit_id, day: l.day }));
    },
    async setHabitDone(habitId, day, done) {
      const own = must(await db.from("habits").select("id").eq("id", habitId).eq("user_id", userId).limit(1));
      if (!own.length) return false;
      if (done) must(await db.from("habit_logs").upsert({ user_id: userId, habit_id: habitId, day }, { onConflict: "habit_id,day", ignoreDuplicates: true }));
      else must(await db.from("habit_logs").delete().eq("habit_id", habitId).eq("day", day).eq("user_id", userId));
      return true;
    },

    async listTransactions() {
      const rows = must(await db.from("transactions").select("*").eq("user_id", userId).eq("status", "posted").in("type", ["income", "expense"])
        .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }));
      return rows.map((t): Transaction => ({
        id: t.id, type: t.type as Transaction["type"], amountCents: t.amount_cents, occurredOn: t.occurred_on, description: t.description,
        categoryId: t.category_id, accountId: t.account_id ?? "", cardId: t.card_id, recurrenceId: t.recurrence_id,
        paymentMethod: t.payment_method ? (UI_METHODS.has(t.payment_method) ? t.payment_method : "other") as Transaction["paymentMethod"] : null,
        source: (["manual", "chat", "whatsapp"].includes(t.source) ? t.source : "manual") as Transaction["source"], createdAt: t.created_at,
      }));
    },
    async createTransaction(input) {
      let cardId: string | null = input.cardId ?? null;
      if (input.paymentMethod === "credit" && !cardId) {
        const cards = must(await db.from("cards").select("id").eq("user_id", userId).is("archived_at", null).order("created_at").limit(1));
        cardId = cards[0]?.id ?? null;
      }
      const accountId = cardId ? null : input.accountId || (await defaultAccountId());
      const t = must(await db.from("transactions").insert({
        user_id: userId, type: input.type, amount_cents: input.amountCents, occurred_on: input.occurredOn, description: input.description,
        category_id: input.categoryId, account_id: accountId, card_id: cardId, payment_method: input.paymentMethod, source: input.source,
        recurrence_id: input.recurrenceId ?? null,
      }).select("*").single());
      return { ...input, id: t.id, accountId: t.account_id ?? "", cardId: t.card_id, createdAt: t.created_at };
    },
    async updateTransaction(id, patch) {
      const row: TablesUpdate<"transactions"> = {};
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.amountCents !== undefined) row.amount_cents = patch.amountCents;
      if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
      if (patch.occurredOn !== undefined) row.occurred_on = patch.occurredOn;
      if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod;
      if (patch.type !== undefined) row.type = patch.type;
      const t = must(await db.from("transactions").update(row).eq("id", id).eq("user_id", userId).in("type", ["income", "expense"]).select("id").maybeSingle() as Result<{ id: string } | null>);
      return t ? (await store.listTransactions()).find((x) => x.id === id) ?? null : null;
    },
    async deleteTransaction(id) {
      return must(await db.from("transactions").delete().eq("id", id).eq("user_id", userId).in("type", ["income", "expense"]).select("id")).length > 0;
    },
    async listCategories() {
      const rows = must(await db.from("categories").select("id, name, kind, parent_id").eq("user_id", userId).is("archived_at", null).order("name"));
      return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind as "expense" | "income", parentId: c.parent_id }));
    },
    async createCategory({ name, kind, parentId }) {
      // subcategoria herda o tipo da categoria de cima
      const parent = parentId ? must(await db.from("categories").select("id, kind").eq("id", parentId).eq("user_id", userId).maybeSingle() as Result<{ id: string; kind: string } | null>) : null;
      if (parentId && !parent) throw new Error("Categoria não encontrada");
      const c = must(await db.from("categories").insert({ user_id: userId, name, kind: parent?.kind ?? kind, parent_id: parent?.id ?? null }).select("id, name, kind, parent_id").single());
      return { id: c.id, name: c.name, kind: c.kind as "expense" | "income", parentId: c.parent_id };
    },
    async updateCategory(id, { name }) {
      const c = must(await db.from("categories").update({ name }).eq("id", id).eq("user_id", userId).select("id, name, kind, parent_id").maybeSingle() as Result<{ id: string; name: string; kind: string; parent_id: string | null } | null>);
      return c ? { id: c.id, name: c.name, kind: c.kind as "expense" | "income", parentId: c.parent_id } : null;
    },
    async archiveCategory(id) {
      // arquivar mantém os lançamentos antigos com a categoria; some só das listas
      if (!/^[0-9a-f-]{36}$/i.test(id)) return false;  // o id vai dentro do filtro "or"
      const at = new Date().toISOString();
      const r = must(await db.from("categories").update({ archived_at: at }).eq("user_id", userId).or(`id.eq.${id},parent_id.eq.${id}`).select("id"));
      return r.length > 0;
    },
    async listAccounts() {
      const [accounts, balances] = await Promise.all([
        db.from("accounts").select("id, name, opening_balance_cents").eq("user_id", userId).is("archived_at", null).order("created_at"),
        db.from("account_balances").select("account_id, balance_cents").eq("user_id", userId),
      ]);
      const bal = new Map(must(balances).map((b) => [b.account_id, b.balance_cents ?? 0]));
      return must(accounts).map((a) => ({ id: a.id, name: a.name, openingBalanceCents: a.opening_balance_cents, balanceCents: bal.get(a.id) ?? a.opening_balance_cents }));
    },

    async recordAction(entity, entityId) {
      const a = must(await db.from("actions").insert({
        user_id: userId, tool_name: `create_${entity}`, entity_table: ENTITY_TABLE[entity], entity_id: entityId, operation: "create", after: {},
      }).select("id, entity_id, undone_at").single());
      return { id: a.id, entity, entityId: a.entity_id, operation: "create", undoneAt: a.undone_at };
    },
    async undoAction(id) {
      const a = must(await db.from("actions").select("*").eq("id", id).eq("user_id", userId).maybeSingle() as Result<{ id: string; entity_table: string; entity_id: string; undone_at: string | null } | null>);
      if (!a || !TABLE_ENTITY[a.entity_table]) return { ok: false, reason: "not_found" };
      if (a.undone_at) return { ok: false, reason: "already_undone" };
      // desfazer uma criação = remover o item criado (hábito leva os registros junto, em cascata)
      const table = a.entity_table as (typeof ENTITY_TABLE)[keyof typeof ENTITY_TABLE];
      must(await db.from(table).delete().eq("id", a.entity_id).eq("user_id", userId));
      must(await db.from("actions").update({ undone_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId));
      await markCards(id);
      return { ok: true };
    },

    async listMessages() {
      // as 500 mais recentes, em ordem de chegada
      const rows = must(await db.from("messages").select("id, role, text_preview, cards, created_at, client_message_id").eq("user_id", userId).eq("visible", true)
        .in("role", ["user", "assistant"]).order("created_at", { ascending: false }).order("seq", { ascending: false }).limit(500));
      return rows.reverse().map((m): ChatMessage => ({
        id: m.id, role: m.role as ChatMessage["role"], text: m.text_preview ?? "", cards: m.cards as ActionCardData[], createdAt: m.created_at,
        ...(m.client_message_id ? { clientId: m.client_message_id } : {}),
      }));
    },
    async appendMessage(msg) {
      const conversationId = await todayConversation();
      // a posição (seq) sai do banco com a conversa travada: mensagens juntas não disputam o mesmo número
      const r = await db.rpc("append_message", {
        p_user: userId, p_conversation: conversationId, p_role: msg.role, p_channel: msg.channel ?? "web",
        p_content: (msg.content ?? [{ type: "text", text: msg.text }]) as Json, p_text_preview: msg.text, p_cards: msg.cards as unknown as Json,
        p_visible: msg.visible ?? true, p_client_message_id: opt(msg.clientMessageId), p_external_message_id: opt(msg.externalMessageId),
        p_model: opt(msg.usage?.model), p_input_tokens: opt(msg.usage?.inputTokens), p_output_tokens: opt(msg.usage?.outputTokens),
        p_cache_read_tokens: opt(msg.usage?.cacheReadTokens),
      }).single();
      const m = must(r as Result<{ id: string; created_at: string }>);
      return { id: m.id, role: msg.role === "system" ? "user" : msg.role, text: msg.text, cards: msg.cards, createdAt: m.created_at };
    },
    async markCardsUndone(actionId) {
      await markCards(actionId);
    },
    async openSupportTicket(message, channel) {
      const dueAt = supportDueAt().toISOString();
      for (let attempt = 0; attempt < 3; attempt++) {
        const protocol = newProtocol();
        const r = await db.from("support_tickets").insert({ user_id: userId, protocol, channel, message, due_at: dueAt }).select("id").single();
        if (r.error?.code === "23505") continue;  // protocolo repetido (raro): sorteia outro
        must(r);
        must(await db.from("notices").insert({ user_id: userId, kind: "support", title: `Chamado aberto (${protocol})`,
          body: `Uma pessoa do time responde até ${new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(dueAt))}.`, href: "/ajustes/suporte" }));
        await notifyOwner({ protocol, message, channel, dueAt, userEmail: email });
        return { protocol, dueAt };
      }
      throw new Error("Não deu para abrir o chamado");
    },
    async listSupportTickets() {
      const rows = must(await db.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50));
      return rows.map((t): SupportTicket => ({ id: t.id, protocol: t.protocol, message: t.message, status: t.status as SupportTicket["status"],
        dueAt: t.due_at, reply: t.reply, answeredAt: t.answered_at, createdAt: t.created_at }));
    },
    async withTurn(fn) {
      const conversationId = await todayConversation();
      // espera a vez por até 45 s; o prazo de 120 s solta a conversa se um servidor cair no meio
      const until = Date.now() + 45_000;
      for (;;) {
        const got = must(await db.rpc("acquire_turn", { p_user: userId, p_conversation: conversationId, p_seconds: 120 }) as Result<boolean>);
        if (got) break;
        if (Date.now() > until) throw new Error("turno ocupado");
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
      }
      try { return await fn(); }
      finally { await db.rpc("release_turn", { p_user: userId, p_conversation: conversationId }); }
    },
    async countUserMessagesSince(iso) {
      const r = await db.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", iso);
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
    async listTodayTranscript() {
      const conv = must(await db.from("conversations").select("id").eq("user_id", userId).eq("local_date", today()).maybeSingle() as Result<{ id: string } | null>);
      if (!conv) return [];
      const rows = must(await db.from("messages").select("role, content").eq("conversation_id", conv.id).eq("user_id", userId).order("seq"));
      return rows.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
    },

    async listCards() {
      const rows = must(await db.from("cards").select("*").eq("user_id", userId).is("archived_at", null).order("created_at"));
      return rows.map((c) => ({ id: c.id, name: c.name, limitCents: c.limit_cents, closingDay: c.closing_day, dueDay: c.due_day }));
    },
    async listRecurrences() {
      const rows = must(await db.from("recurrences").select("*").eq("user_id", userId).eq("frequency", "monthly"));
      return rows.map((r) => ({
        id: r.id, kind: r.kind as "bill" | "subscription" | "income", description: r.description, amountCents: r.amount_cents,
        dayOfMonth: Number(r.anchor_on.slice(8, 10)), categoryId: r.category_id, active: !r.paused,
        paymentMethod: (r.card_id ? "credit" : r.payment_method && UI_METHODS.has(r.payment_method) ? r.payment_method : r.payment_method ? "other" : null) as Transaction["paymentMethod"],
      })).sort((a, b) => a.dayOfMonth - b.dayOfMonth);
    },
    async setRecurrenceActive(id, active) {
      return must(await db.from("recurrences").update({ paused: !active }).eq("id", id).eq("user_id", userId).select("id")).length > 0;
    },
    async listInstallments() {
      const rows = must(await db.from("installment_purchases").select("*").eq("user_id", userId).order("first_due_on"));
      return rows.map((p) => ({ id: p.id, description: p.description, totalCents: p.total_cents, count: p.installments_count,
        firstMonth: p.first_due_on.slice(0, 7), cardId: p.card_id, categoryId: p.category_id }));
    },

    async listProjects() {
      const rows = must(await db.from("projects").select("*, milestones(id, title, done_at, position)").eq("user_id", userId).neq("status", "archived").order("created_at"));
      return rows.map((p) => ({
        id: p.id, name: p.name, description: p.description ?? "", dueOn: p.due_on, status: p.status === "done" ? "done" as const : "active" as const,
        milestones: [...p.milestones].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, title: m.title, done: !!m.done_at })),
      }));
    },
    async setMilestoneDone(projectId, milestoneId, done) {
      return must(await db.from("milestones").update({ done_at: done ? new Date().toISOString() : null })
        .eq("id", milestoneId).eq("project_id", projectId).eq("user_id", userId).select("id")).length > 0;
    },
    async listGoals() {
      const rows = must(await db.from("goals").select("*, goal_entries(value)").eq("user_id", userId).in("status", ["active", "paused", "done"]).order("created_at"));
      return rows.map((g) => {
        const money = g.kind === "financial";
        const scale = money ? 100 : 1;  // metas de dinheiro guardam reais; as telas usam centavos
        return {
          id: g.id, title: g.title, unit: money ? "money" as const : "count" as const, targetValue: Math.round(g.target_value * scale),
          currentValue: Math.round(g.goal_entries.reduce((s, e) => s + Number(e.value), 0) * scale), startOn: g.starts_on, dueOn: g.deadline,
        };
      });
    },
    async addGoalProgress(id, delta) {
      const g = must(await db.from("goals").select("kind").eq("id", id).eq("user_id", userId).maybeSingle() as Result<{ kind: string } | null>);
      if (!g) return null;
      must(await db.from("goal_entries").insert({ user_id: userId, goal_id: id, value: g.kind === "financial" ? delta / 100 : delta, occurred_on: today() }));
      return (await store.listGoals()).find((x) => x.id === id) ?? null;
    },
    async listNotes() {
      const [notes, journal] = await Promise.all([
        db.from("notes").select("*, notebooks(name)").eq("user_id", userId).is("archived_at", null),
        db.from("journal_entries").select("*").eq("user_id", userId),
      ]);
      const list: Note[] = [
        ...must(notes).map((n) => ({ id: n.id, title: n.title, body: n.content, notebook: n.notebooks?.name ?? "Geral", kind: "note" as const,
          pinned: n.pinned, createdAt: n.created_at, updatedAt: n.updated_at })),
        ...must(journal).map((j) => ({ id: j.id, title: "", body: j.content, notebook: "Diário", kind: "journal" as const, pinned: false,
          createdAt: noonUtc(j.entry_on), updatedAt: j.updated_at })),
      ];
      return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    },
    async createNote({ title, body, notebook, kind }) {
      if (kind === "journal") {
        const content = [title, body].filter(Boolean).join("\n\n");
        const j = must(await db.from("journal_entries").insert({ user_id: userId, entry_on: today(), content }).select("*").single());
        return { id: j.id, title: "", body: j.content, notebook: "Diário", kind, pinned: false, createdAt: j.created_at, updatedAt: j.updated_at };
      }
      const n = must(await db.from("notes").insert({ user_id: userId, title, content: body, notebook_id: await notebookId(notebook) }).select("*").single());
      return { id: n.id, title: n.title, body: n.content, notebook, kind, pinned: n.pinned, createdAt: n.created_at, updatedAt: n.updated_at };
    },
    async updateNote(id, patch) {
      const row: TablesUpdate<"notes"> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.body !== undefined) row.content = patch.body;
      if (patch.pinned !== undefined) row.pinned = patch.pinned;
      if (patch.notebook !== undefined) row.notebook_id = await notebookId(patch.notebook);
      const n = must(await db.from("notes").update(row).eq("id", id).eq("user_id", userId).select("*, notebooks(name)").maybeSingle() as Result<{ id: string; title: string; content: string; pinned: boolean; created_at: string; updated_at: string; notebooks: { name: string } | null } | null>);
      return n ? { id: n.id, title: n.title, body: n.content, notebook: n.notebooks?.name ?? "Geral", kind: "note", pinned: n.pinned, createdAt: n.created_at, updatedAt: n.updated_at } : null;
    },
    async listAutomations() {
      const rows = must(await db.from("automations").select("*, automation_runs(finished_at)").eq("user_id", userId).order("created_at"));
      return rows.map((a) => ({
        id: a.id, title: a.title, prompt: a.instruction, time: hm(a.run_time)!, channel: a.channel as "push" | "whatsapp" | "email", active: a.active,
        weekdays: a.schedule === "daily" ? [0, 1, 2, 3, 4, 5, 6] : a.schedule === "weekly" ? a.weekdays : [],
        lastRunAt: a.automation_runs.map((r) => r.finished_at).filter((x): x is string => !!x).sort().pop() ?? null,
      }));
    },
    async setAutomationActive(id, active) {
      return must(await db.from("automations").update({ active }).eq("id", id).eq("user_id", userId).select("id")).length > 0;
    },
    async addNotice(n) {
      must(await db.from("notices").insert({ user_id: userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body, href: n.href }));
    },
    async listBudgets() {
      const rows = must(await db.from("budgets").select("category_id, amount_cents").eq("user_id", userId).eq("period", "monthly"));
      return rows.map((b): Budget => ({ categoryId: b.category_id, amountCents: b.amount_cents }));
    },
    async setBudget(categoryId, amountCents) {
      // a categoria precisa ser desta pessoa e de gasto (a FK composta também barra outra conta)
      if (!/^[0-9a-f-]{36}$/i.test(categoryId)) return false;
      const cat = must(await db.from("categories").select("id").eq("id", categoryId).eq("user_id", userId).eq("kind", "expense").is("archived_at", null).maybeSingle() as Result<{ id: string } | null>);
      if (!cat) return false;
      if (amountCents === null) {
        must(await db.from("budgets").delete().eq("user_id", userId).eq("category_id", categoryId));
        return true;
      }
      must(await db.from("budgets").upsert({ user_id: userId, category_id: categoryId, amount_cents: amountCents, period: "monthly" }, { onConflict: "category_id,period" }));
      return true;
    },
    async listNotices() {
      const rows = must(await db.from("notices").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100));
      return rows.map((n) => ({ id: n.id, kind: n.kind as "system", title: n.title, body: n.body, href: n.href, createdAt: n.created_at, readAt: n.read_at }));
    },
    async markNoticesRead(ids) {
      let q = db.from("notices").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (ids !== "all") q = q.in("id", ids);
      must(await q);
    },
    async listEvents() {
      const from = new Date(Date.now() - 62 * 86_400_000).toISOString();
      const rows = must(await db.from("calendar_events").select("*, calendars!inner(integrations!inner(provider, status))").eq("user_id", userId)
        .neq("status", "cancelled").gte("ends_at", from).order("starts_at"));
      return rows.filter((e) => e.calendars.integrations.status === "active").map((e): CalendarEvent => ({
        id: e.id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at, location: e.location,
        source: e.calendars.integrations.provider === "microsoft" ? "outlook" : "google",
      }));
    },
    async listFocusSessions() {
      const rows = must(await db.from("focus_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(50));
      return rows.map((f) => ({ id: f.id, title: f.title ?? "Foco", minutes: f.planned_minutes ?? 0, startedAt: f.started_at, finishedAt: f.ended_at }));
    },
    async saveFocusSession(input) {
      const f = must(await db.from("focus_sessions").insert({ user_id: userId, title: input.title, planned_minutes: input.minutes,
        started_at: input.startedAt, ended_at: input.finishedAt }).select("id").single());
      return { ...input, id: f.id };
    },

    async listWorkouts() {
      const [sessions, sets] = await Promise.all([
        db.from("workout_plan_sessions").select("*, workout_plans!inner(active), workout_plan_exercises(*)").eq("user_id", userId).order("position"),
        db.from("workout_sets").select("exercise_name, load_kg").eq("user_id", userId).not("load_kg", "is", null),
      ]);
      const best = new Map<string, number>();
      for (const s of must(sets)) best.set(s.exercise_name, Math.max(best.get(s.exercise_name) ?? 0, Number(s.load_kg)));
      return must(sessions).filter((s) => s.workout_plans.active).map((s) => ({
        id: s.id, name: s.name, weekdays: s.weekdays,
        exercises: [...s.workout_plan_exercises].sort((a, b) => a.position - b.position).map((e) => {
          const load = e.target_load_kg === null ? null : Number(e.target_load_kg);
          const logged = best.get(e.exercise_name);
          return { id: e.id, name: e.exercise_name, sets: e.target_sets ?? 1, reps: e.target_reps ?? 1, loadKg: load,
            bestKg: logged !== undefined || load !== null ? Math.max(logged ?? 0, load ?? 0) : null };
        }),
      }));
    },
    async listWorkoutLogs() {
      const rows = must(await db.from("workout_logs").select("plan_session_id, started_at").eq("user_id", userId).not("plan_session_id", "is", null));
      return rows.map((l) => ({ workoutId: l.plan_session_id!, day: localDate(new Date(l.started_at), tz) }));
    },
    async setWorkoutDone(workoutId, day, done) {
      const own = must(await db.from("workout_plan_sessions").select("id").eq("id", workoutId).eq("user_id", userId).limit(1));
      if (!own.length) return false;
      const [start, end] = dayRange(day);
      must(await db.from("workout_logs").delete().eq("user_id", userId).eq("plan_session_id", workoutId).gte("started_at", start).lt("started_at", end));
      if (done) must(await db.from("workout_logs").insert({ user_id: userId, plan_session_id: workoutId, started_at: noonUtc(day) }));
      return true;
    },
    async listMeals() {
      const rows = must(await db.from("diet_meals").select("*, diet_plans!inner(active)").eq("user_id", userId).order("at_time"));
      return rows.filter((m) => m.diet_plans.active).map((m) => ({ id: m.id, name: m.name, time: hm(m.at_time) ?? "", kcal: m.kcal ?? 0,
        items: m.items.split("\n").map((s) => s.trim()).filter(Boolean) }));
    },
    async listMealLogs() {
      const [meals, logs] = await Promise.all([store.listMeals(), db.from("food_logs").select("meal_name, logged_on").eq("user_id", userId)]);
      const byName = new Map(meals.map((m) => [m.name, m.id]));
      return must(logs).filter((l) => l.meal_name && byName.has(l.meal_name)).map((l) => ({ mealId: byName.get(l.meal_name!)!, day: l.logged_on }));
    },
    async setMealDone(mealId, day, done) {
      const meal = (await store.listMeals()).find((m) => m.id === mealId);
      if (!meal) return false;
      must(await db.from("food_logs").delete().eq("user_id", userId).eq("meal_name", meal.name).eq("logged_on", day));
      if (done) must(await db.from("food_logs").insert({ user_id: userId, logged_on: day, meal_name: meal.name, items: meal.items.join("\n") || meal.name, kcal: meal.kcal, source: "manual" }));
      return true;
    },
    async listMeasurements() {
      const rows = must(await db.from("body_measurements").select("kind, value, measured_at").eq("user_id", userId).in("kind", ["weight", "waist", "hip"]).order("measured_at"));
      const byDay = new Map<string, BodyMeasurement>();
      for (const r of rows) {
        const day = localDate(new Date(r.measured_at), tz);
        const m = byDay.get(day) ?? { id: day, day, weightKg: null, waistCm: null, hipCm: null };
        if (r.kind === "weight") m.weightKg = Number(r.value);
        if (r.kind === "waist") m.waistCm = Number(r.value);
        if (r.kind === "hip") m.hipCm = Number(r.value);
        byDay.set(day, m);
      }
      return [...byDay.values()];
    },
    async addMeasurement(input) {
      const [start, end] = dayRange(input.day);
      const values: Array<["weight" | "waist" | "hip", number | null, "kg" | "cm"]> = [["weight", input.weightKg, "kg"], ["waist", input.waistCm, "cm"], ["hip", input.hipCm, "cm"]];
      for (const [kind, value, unit] of values) {
        if (value === null) continue;
        must(await db.from("body_measurements").delete().eq("user_id", userId).eq("kind", kind).gte("measured_at", start).lt("measured_at", end));
        must(await db.from("body_measurements").insert({ user_id: userId, kind, value, unit, measured_at: noonUtc(input.day) }));
      }
      return { ...input, id: input.day };
    },

    async getSettings() {
      const [p, sub, wa, integ] = await Promise.all([
        db.from("profiles").select("*").eq("user_id", userId).single(),
        db.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end, canceled_at, cancel_protocol").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        db.from("channel_links").select("external_id, verified_at").eq("user_id", userId).eq("channel", "whatsapp").maybeSingle(),
        db.from("integrations").select("provider").eq("user_id", userId).eq("status", "active"),
      ]);
      const prof = must(p);
      // vale a assinatura ativa, ou a cancelada que ainda está dentro do período pago
      const nowIso = new Date().toISOString();
      const s = must(sub).find((x) => ["active", "trialing", "past_due"].includes(x.status) || (x.current_period_end ?? "") > nowIso);
      const providers = new Set(must(integ).map((i) => i.provider));
      const waRow = must(wa as Result<{ external_id: string; verified_at: string | null } | null>);
      // F2: voltou da página de pagamento e a Asaas ainda não avisou: libera por 2 h, sem "assinatura inválida"
      const confirming = !s && prof.trial_ends_on < today()
        ? must(await db.from("checkout_sessions").select("plan").eq("user_id", userId).eq("status", "pending")
            .gte("returned_at", new Date(Date.now() - 2 * 3_600_000).toISOString()).order("returned_at", { ascending: false }).limit(1))[0]
        : undefined;
      const plan: Settings["plan"] = s ? (s.plan as "monthly" | "yearly") : confirming ? (confirming.plan as "monthly" | "yearly")
        : prof.trial_ends_on >= today() ? "trial" : "none";
      return {
        name: prof.display_name ?? "você", email: email ?? "", timezone: prof.timezone, plan, trialEndsOn: plan === "trial" ? prof.trial_ends_on : null,
        billing: s ? {
          periodEnd: s.current_period_end, renews: !s.cancel_at_period_end && s.status !== "canceled", pastDue: s.status === "past_due",
          canceledAt: s.canceled_at, cancelProtocol: s.cancel_protocol,
        } : confirming ? { periodEnd: null, renews: false, pastDue: false, confirming: true } : undefined,
        tone: (prof.assistant_tone === "custom" ? "warm" : prof.assistant_tone) as Settings["tone"], answerLength: prof.answer_length as Settings["answerLength"],
        voice: (prof.assistant_voice === "male" ? "male" : "female"), memoryEnabled: prof.memory_enabled, theme: prof.theme as Settings["theme"],
        briefingTime: prof.briefing_enabled ? hm(prof.briefing_time) : null,
        channels: { whatsapp: waRow?.external_id ?? null, whatsappVerified: !!waRow?.verified_at, telegram: prof.notify_telegram, email: prof.notify_email, push: prof.notify_push },
        calendars: { google: providers.has("google"), outlook: providers.has("microsoft") },
      };
    },
    async updateSettings(patch) {
      const row: TablesUpdate<"profiles"> = {};
      if (patch.name !== undefined) row.display_name = patch.name;
      if (patch.tone !== undefined) row.assistant_tone = patch.tone;
      if (patch.answerLength !== undefined) row.answer_length = patch.answerLength;
      if (patch.voice !== undefined) row.assistant_voice = patch.voice;
      if (patch.memoryEnabled !== undefined) row.memory_enabled = patch.memoryEnabled;
      if (patch.theme !== undefined) row.theme = patch.theme;
      if (patch.briefingTime !== undefined) {
        row.briefing_enabled = patch.briefingTime !== null;
        if (patch.briefingTime) row.briefing_time = patch.briefingTime;
      }
      if (patch.channels) {
        row.notify_push = patch.channels.push;
        row.notify_email = patch.channels.email;
        row.notify_telegram = patch.channels.telegram;
        const current = must(await db.from("channel_links").select("external_id").eq("user_id", userId).eq("channel", "whatsapp").maybeSingle() as Result<{ external_id: string } | null>);
        if (patch.channels.whatsapp === null && current) must(await db.from("channel_links").delete().eq("user_id", userId).eq("channel", "whatsapp"));
        // número novo fica pendente até a pessoa confirmar pelo próprio WhatsApp (lib/whatsapp/link.ts)
        if (patch.channels.whatsapp && patch.channels.whatsapp !== current?.external_id) {
          must(await db.from("channel_links").upsert({ user_id: userId, channel: "whatsapp", external_id: patch.channels.whatsapp, verified_at: null },
            { onConflict: "user_id,channel" }));
        }
      }
      // agendas: aqui só dá para desconectar; conectar passa pelo OAuth do Google ou da Microsoft
      if (patch.calendars) {
        for (const [ui, provider] of [["google", "google"], ["outlook", "microsoft"]] as const) {
          if (!patch.calendars[ui]) must(await db.from("integrations").update({ status: "revoked" }).eq("user_id", userId).eq("provider", provider));
        }
      }
      if (Object.keys(row).length) must(await db.from("profiles").update(row).eq("user_id", userId));
      return store.getSettings();
    },
    async deleteAllData() {
      // apagar o usuário do Auth apaga tudo dele em cascata (FKs on delete cascade)
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
  return store;
}
