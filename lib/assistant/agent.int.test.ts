import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataStore } from "@/lib/data/store";
import { createSupabaseStore } from "@/lib/data/supabase-store";
import type { Database } from "@/lib/supabase/database.types";

// Ciclo do agente contra uma API falsa (sem gastar a chave) e o Supabase local:
// confere o pedido enviado, a execução das ferramentas e o histórico somente-anexar.
// SUPABASE_TEST=1 npx vitest run lib/assistant/agent.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

type Req = { headers: http.IncomingHttpHeaders; body: Record<string, unknown> & { messages: Array<{ role: string; content: unknown }> } };

describe.skipIf(!run)("agente", () => {
  const requests: Req[] = [];
  const replies: object[] = [];
  let server: http.Server;
  let store: DataStore;
  let userId = "";
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const msg = (content: object[], stop_reason: string) => ({
    id: `msg_${requests.length}`, type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason, stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80, cache_creation_input_tokens: 0 },
  });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        requests.push({ headers: req.headers, body: JSON.parse(data) });
        const reply = replies.shift() as { type?: string };
        res.writeHead(reply?.type === "error" ? 400 : 200, { "content-type": "application/json" });
        res.end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.ANTHROPIC_API_KEY = "teste";
    const { data } = await admin.auth.admin.createUser({ email: `agente-${Date.now()}@teste.local`, password: "x".repeat(12), email_confirm: true, user_metadata: { name: "Ana" } });
    userId = data.user!.id;
    store = await createSupabaseStore(admin, userId, null);
  });
  afterAll(async () => {
    server.close();
    await admin.auth.admin.deleteUser(userId);
  });

  it("chama a ferramenta, devolve o card e grava cada passo", async () => {
    const { runAgent } = await import("./agent");
    replies.push(
      msg([{ type: "thinking", thinking: "", signature: "sig1" },
        { type: "tool_use", id: "toolu_1", name: "record_transaction", input: { type: "expense", amount: 35.9, description: "Padaria", category: "Alimentação", payment_method: "pix", occurred_on: null } }], "tool_use"),
      msg([{ type: "text", text: "Anotado!" }], "end_turn"),
    );
    const reply = await runAgent({ store, text: "gastei 35,90 na padaria no pix", channel: "web", now: new Date("2026-10-08T15:00:00Z") });
    expect(reply.text).toBe("Anotado!");
    expect(reply.cards).toHaveLength(1);
    expect(reply.cards[0].value).toMatch(/35,90/);

    // custo: as duas chamadas da mensagem viram uma linha em ai_usage, com os tokens somados
    const { data: usage } = await admin.from("ai_usage").select("*").eq("user_id", userId);
    expect(usage).toHaveLength(1);
    expect(usage![0]).toMatchObject({ model: "claude-opus-5-5", calls: 2, input_tokens: 200, output_tokens: 40, cache_read_tokens: 160, cache_write_tokens: 0 });

    const first = requests[0];
    expect(first.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(first.body.model).toBe("claude-sonnet-5-5");  // padrão sem configuração
    expect(first.body.fallbacks).toBe("default");
    expect(first.body.output_config).toEqual({ effort: "medium" });
    // sem modo estrito: a API recusa 22 ferramentas estritas (limite de ferramentas, de parâmetros nulos e de gramática)
    const tools = first.body.tools as Array<{ name: string; strict?: boolean }>;
    expect(tools.length).toBeGreaterThanOrEqual(20);
    expect(tools.some((t) => t.strict)).toBe(false);
    // 1ª mensagem do dia: usuário com data e hora, depois o contexto como mensagem de sistema
    expect(first.body.messages.map((m) => m.role)).toEqual(["user", "system"]);
    expect(JSON.stringify(first.body.messages[0].content)).toContain("08/10/2026 12:00");
    expect(first.body.messages[1].content).toContain("Pessoa: Ana");
    // 2º pedido leva o resultado da ferramenta
    const second = requests[1].body.messages;
    expect(second.at(-1)!.role).toBe("user");
    expect(JSON.stringify(second.at(-1)!.content)).toContain("tool_result");

    expect((await store.listTransactions())[0].description).toBe("Padaria");
    const visible = await store.listMessages();
    expect(visible.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(visible[1].cards).toHaveLength(1);
  });

  it("na mensagem seguinte reenvia o histórico igual, sem contexto repetido", async () => {
    const { runAgent } = await import("./agent");
    const before = requests.length;
    replies.push(msg([{ type: "text", text: "Hoje você gastou R$ 35,90." }], "end_turn"));
    await runAgent({ store, text: "quanto gastei hoje?", channel: "web", now: new Date("2026-10-08T15:05:00Z") });
    const body = requests[before].body;
    const prev = requests[before - 1].body.messages;
    // prefixo idêntico ao último pedido + a resposta final + a pergunta nova
    expect(body.messages.slice(0, prev.length)).toEqual(prev);
    expect(body.messages[prev.length]).toEqual({ role: "assistant", content: [{ type: "text", text: "Anotado!" }] });
    expect(body.messages.filter((m) => m.role === "system")).toHaveLength(1);
  });

  it("apaga um lançamento pela conversa: consulta o id e apaga", async () => {
    const { runAgent } = await import("./agent");
    const tx = (await store.listTransactions())[0];
    replies.push(
      msg([{ type: "tool_use", id: "toolu_q", name: "query_transactions", input: { text: "padaria", from: null, to: null } }], "tool_use"),
      msg([{ type: "tool_use", id: "toolu_d", name: "delete_transaction", input: { transaction_id: tx.id } }], "tool_use"),
      msg([{ type: "text", text: "Apaguei o gasto da padaria." }], "end_turn"),
    );
    const before = requests.length;
    const r = await runAgent({ store, text: "apaga o gasto da padaria", channel: "web" });
    expect(r.text).toBe("Apaguei o gasto da padaria.");
    // o resultado da consulta levou o id para o modelo
    expect(JSON.stringify(requests[before + 1].body.messages.at(-1))).toContain(tx.id);
    expect(await store.listTransactions()).toEqual([]);
  });

  it("treino, plano alimentar, projeto, meta e peso pelo chat; depois progresso, etapa, revisão e remoção", async () => {
    const { runAgent } = await import("./agent");
    const use = (name: string, input: object, n: number) => ({ type: "tool_use", id: `toolu_${name}_${n}`, name, input });
    replies.push(
      msg([
        use("create_workout_plan", { name: "Hipertrofia", sessions: [
          { name: "Treino A", weekdays: [1, 4], exercises: [{ name: "Supino reto", sets: 4, reps: 10, load_kg: 40, rest_seconds: 90 }, { name: "Remada", sets: 4, reps: 10, load_kg: null, rest_seconds: null }] },
          { name: "Treino B", weekdays: [2, 5], exercises: [{ name: "Agachamento", sets: 3, reps: 12, load_kg: 60, rest_seconds: 120 }] },
        ] }, 1),
        use("create_meal_plan", { name: "Plano da nutri", kcal_training: 2400, kcal_rest: 2100, protein_g: 160, carbs_g: null, fat_g: null, meals: [
          { name: "Café da manhã", time: "07:30", items: ["2 ovos", "pão integral"], kcal: 450 }, { name: "Almoço", time: "12:30", items: ["arroz", "feijão", "frango"], kcal: 700 },
        ] }, 1),
        use("create_project", { name: "Mudança de apartamento", description: null, starts_on: null, due_on: "2026-10-30", milestones: [{ title: "Visitar", due_on: null }, { title: "Assinar", due_on: "2026-10-20" }] }, 1),
        use("create_goal", { title: "Juntar 20 mil", unit: "money", target: 20000, monthly_plan: 2000, due_on: "2026-12-31" }, 1),
        use("log_measurement", { weight_kg: 82.4, waist_cm: null, hip_cm: null, day: null }, 1),
      ], "tool_use"),
      msg([{ type: "text", text: "Tudo guardado." }], "end_turn"),
    );
    const r1 = await runAgent({ store, text: "monta meu treino, minha dieta, o projeto da mudança, a meta e pesei 82,4", channel: "web", now: new Date("2026-10-09T15:00:00Z") });
    expect(r1.cards.map((c) => c.kind)).toEqual(["workout", "meal", "project", "goal"]);
    expect(r1.cards[0]).toMatchObject({ title: "Hipertrofia", value: "2 treinos", href: "/saude/treino" });
    expect(r1.cards[3].value).toMatch(/20\.000,00/);

    const workouts = await store.listWorkouts();
    expect(workouts.map((w) => w.name)).toEqual(["Treino A", "Treino B"]);
    expect(workouts[0].weekdays).toEqual([1, 4]);
    expect(workouts[0].exercises.map((e) => [e.name, e.sets, e.reps, e.loadKg])).toEqual([["Supino reto", 4, 10, 40], ["Remada", 4, 10, null]]);
    expect((await store.listMeals()).map((m) => [m.name, m.time, m.kcal])).toEqual([["Café da manhã", "07:30", 450], ["Almoço", "12:30", 700]]);
    const project = (await store.listProjects()).find((p) => p.name === "Mudança de apartamento")!;
    expect(project.milestones.map((m) => m.title)).toEqual(["Visitar", "Assinar"]);
    const goal = (await store.listGoals()).find((g) => g.title === "Juntar 20 mil")!;
    expect(goal).toMatchObject({ unit: "money", targetValue: 2_000_000, currentValue: 0, dueOn: "2026-12-31" });
    expect((await store.listMeasurements()).at(-1)).toMatchObject({ weightKg: 82.4 });

    // segunda rodada: usa os ids de verdade
    replies.push(
      msg([
        use("add_goal_progress", { goal_id: goal.id, amount: 1500 }, 2),
        use("complete_item", { kind: "milestone", id: project.milestones[0].id, done: true, day: null }, 2),
        use("complete_item", { kind: "workout", id: workouts[0].id, done: true, day: "2026-10-09" }, 2),
        use("create_automation", { title: "Resumo da manhã", prompt: "Compromissos e tarefas do dia", repeat: "weekly", weekdays: [1, 2, 3, 4, 5], run_on: null, time: "07:00", channel: "push", sources: ["tasks", "habits"] }, 2),
        use("query_areas", { area: "goals" }, 2),
      ], "tool_use"),
      msg([{ type: "text", text: "Feito." }], "end_turn"),
    );
    const r2 = await runAgent({ store, text: "guardei 1500 na meta, visitei os apartamentos, treinei hoje e quero um resumo às 7h nos dias úteis", channel: "web", now: new Date("2026-10-09T15:05:00Z") });
    expect(r2.cards.map((c) => c.kind)).toEqual(["automation"]);
    expect(r2.cards[0]).toMatchObject({ title: "Resumo da manhã", value: "07:00" });
    expect((await store.listGoals()).find((g) => g.id === goal.id)!.currentValue).toBe(150_000);
    expect((await store.listProjects()).find((p) => p.id === project.id)!.milestones[0].done).toBe(true);
    expect((await store.listWorkoutLogs())).toEqual([{ workoutId: workouts[0].id, day: "2026-10-09" }]);
    const automation = (await store.listAutomations())[0];
    expect(automation).toMatchObject({ schedule: "weekly", weekdays: [1, 2, 3, 4, 5], channel: "push", active: true });
    // o resultado de query_areas (ferramentas do mesmo pedido rodam juntas) levou a meta, com o id, para o modelo
    expect(JSON.stringify(requests.at(-1)!.body.messages.at(-1))).toContain(goal.id);

    // remover e desfazer
    replies.push(
      msg([use("remove_item", { kind: "project", id: project.id }, 3), use("remove_item", { kind: "automation", id: automation.id }, 3)], "tool_use"),
      msg([{ type: "text", text: "Removi." }], "end_turn"),
    );
    await runAgent({ store, text: "tira o projeto da mudança e a revisão da manhã", channel: "web", now: new Date("2026-10-09T15:10:00Z") });
    expect((await store.listProjects()).some((p) => p.id === project.id)).toBe(false);
    expect(await store.listAutomations()).toEqual([]);
    // entrada inválida volta como erro para o modelo corrigir, sem gravar nada
    replies.push(
      msg([use("create_goal", { title: "Meta sem valor", unit: "money", target: -5, monthly_plan: null, due_on: null }, 4)], "tool_use"),
      msg([{ type: "text", text: "Qual o valor da meta?" }], "end_turn"),
    );
    const bad = await runAgent({ store, text: "cria uma meta", channel: "web", now: new Date("2026-10-09T15:15:00Z") });
    expect(bad.cards).toEqual([]);
    expect((await store.listGoals()).some((g) => g.title === "Meta sem valor")).toBe(false);
  });

  it("foto vai junto da mensagem para o modelo, fica no histórico do dia e as antigas viram texto", async () => {
    const { runAgent } = await import("./agent");
    const photo = { mediaType: "image/jpeg" as const, data: Buffer.from("jpeg-de-mentira").toString("base64") };
    replies.push(
      msg([{ type: "tool_use", id: "toolu_foto", name: "record_transaction", input: { type: "expense", amount: 87.5, description: "Mercado Bom Preço", category: "Mercado", payment_method: "debit", occurred_on: null } }], "tool_use"),
      msg([{ type: "text", text: "Registrei o comprovante." }], "end_turn"),
    );
    const before = requests.length;
    const r = await runAgent({ store, text: "📷 Foto", channel: "web", now: new Date("2026-10-09T16:00:00Z"), images: [photo] });
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].value).toMatch(/87,50/);
    const content = requests[before].body.messages.at(-1)!.content as Array<{ type: string; source?: { type: string; media_type: string; data: string } }>;
    expect(content.map((b) => b.type)).toEqual(["text", "image"]);
    expect(content[1].source).toEqual({ type: "base64", media_type: "image/jpeg", data: photo.data });
    expect(requests[before].body.system as unknown as string).toBeDefined();
    expect(JSON.stringify(requests[before].body.system)).toContain("Fotos:");

    // na mensagem seguinte do mesmo dia, a foto continua no histórico (igual byte a byte)
    replies.push(msg([{ type: "text", text: "Foi no débito." }], "end_turn"));
    const n = requests.length;
    await runAgent({ store, text: "foi no débito mesmo?", channel: "web", now: new Date("2026-10-09T16:05:00Z") });
    expect(JSON.stringify(requests[n].body.messages)).toContain(photo.data);

    // limpeza: troca a foto por texto e o resto do histórico continua intacto e somente-anexar
    const { data: purged, error } = await admin.rpc("purge_old_message_images", { p_days: 0 });
    expect(error).toBeNull();
    expect(purged).toBeGreaterThanOrEqual(1);
    const { data: rows } = await admin.from("messages").select("role, seq, content").eq("user_id", userId).order("seq");
    expect(JSON.stringify(rows)).not.toContain(photo.data);
    expect(JSON.stringify(rows)).toContain("[foto removida]");
    const edit = await admin.from("messages").update({ content: [] }).eq("user_id", userId);
    expect(edit.error?.message).toMatch(/somente-anexar/);
    const noAnon = await createClient<Database>("http://127.0.0.1:54321", "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH", { auth: { persistSession: false } }).rpc("purge_old_message_images", { p_days: 0 });
    expect(noAnon.error).not.toBeNull();
  });

  it("se a API falhar, fecha o turno com uma resposta e o histórico segue válido", async () => {
    const { runAgent } = await import("./agent");
    replies.push({ type: "error", error: { type: "invalid_request_error", message: "x" } });
    const r = await runAgent({ store, text: "teste de erro", channel: "web" });
    expect(r.text).toMatch(/Não consegui responder/);
    const t = await store.listTodayTranscript();
    expect(t.at(-1)!.role).toBe("assistant");
  });

  it("o modelo e o nível vêm da configuração; o Haiku vai sem o recurso de reserva", async () => {
    const { runAgent } = await import("./agent");
    const ask = async (text: string, now: string) => {
      replies.push(msg([{ type: "text", text: "ok" }], "end_turn"));
      const before = requests.length;
      await runAgent({ store, text, channel: "web", now: new Date(now) });
      return requests[before];
    };
    try {
      process.env.ANTHROPIC_MODEL = "claude-haiku-5-5"; process.env.ANTHROPIC_EFFORT = "high";
      const haiku = await ask("oi haiku", "2026-10-08T16:00:00Z");
      expect(haiku.body.model).toBe("claude-haiku-5-5");
      expect(haiku.body.output_config).toEqual({ effort: "high" });
      expect(haiku.body.fallbacks).toBeUndefined();
      expect(haiku.headers["anthropic-beta"] ?? "").not.toContain("server-side-fallback");

      process.env.ANTHROPIC_MODEL = "claude-opus-5-5"; process.env.ANTHROPIC_EFFORT = "xhigh";
      const opus = await ask("oi opus", "2026-10-08T16:01:00Z");
      expect(opus.body.model).toBe("claude-opus-5-5");
      expect(opus.body.output_config).toEqual({ effort: "xhigh" });
      expect(opus.body.fallbacks).toBe("default");

      process.env.ANTHROPIC_MODEL = "modelo-que-nao-existe"; process.env.ANTHROPIC_EFFORT = "";  // inválido: volta ao padrão
      const padrao = await ask("oi padrão", "2026-10-08T16:02:00Z");
      expect(padrao.body.model).toBe("claude-sonnet-5-5");
      expect(padrao.body.output_config).toEqual({ effort: "medium" });
    } finally {
      delete process.env.ANTHROPIC_MODEL; delete process.env.ANTHROPIC_EFFORT;
    }
  });
});
