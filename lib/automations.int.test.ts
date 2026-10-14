import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

// Revisões agendadas contra o Supabase local e uma API da Anthropic falsa (sem gastar a chave).
// SUPABASE_TEST=1 npx vitest run lib/automations.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("revisões agendadas", () => {
  const apiCalls: Array<{ body: { model: string; system: string; tools?: unknown; messages: Array<{ content: string }> } }> = [];
  let apiFails = false;
  const queued: object[] = [];  // respostas específicas de um teste (a pesquisa); vazia = resposta padrão
  let server: http.Server;
  let userId = "";
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        apiCalls.push({ body: JSON.parse(data) });
        if (apiFails) { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "fora do ar" } })); return; }
        res.writeHead(200, { "content-type": "application/json" });
        if (queued.length) { res.end(JSON.stringify(queued.shift())); return; }
        res.end(JSON.stringify({
          id: "msg_rev", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null,
          content: [{ type: "text", text: "*Seu dia*\n• Pagar a conta de luz hoje" }],
          usage: { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), ANTHROPIC_API_KEY: "teste", ANTHROPIC_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    delete process.env.WHATSAPP_PROVIDER; delete process.env.UAZAPI_BASE_URL; delete process.env.UAZAPI_INSTANCE_TOKEN;
    const { data } = await admin.auth.admin.createUser({ email: `revisao-${Date.now()}@teste.local`, password: "x".repeat(12), email_confirm: true, user_metadata: { name: "Bia" } });
    userId = data.user!.id;
  });
  afterAll(async () => {
    server.close();
    await admin.auth.admin.deleteUser(userId);
  });

  const make = async (over: Partial<Database["public"]["Tables"]["automations"]["Insert"]> = {}, minutesAgo = 1) => {
    const { data, error } = await admin.from("automations").insert({
      user_id: userId, title: "Resumo da manhã", instruction: "Tarefas do dia", sources: ["tasks"], schedule: "daily", run_time: "07:00", timezone: "America/Sao_Paulo",
      next_run_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), channel: "push", ...over,
    }).select("id, next_run_at").single();
    if (error) throw error;
    return data;
  };
  const runs = async (id: string) => (await admin.from("automation_runs").select("status, error, scheduled_for").eq("automation_id", id)).data ?? [];

  it("revisão no horário vira texto, aviso, custo e próximo horário; duas varreduras juntas rodam uma vez só", async () => {
    const { runDueAutomations } = await import("./automations");
    await admin.from("tasks").insert({ user_id: userId, title: "Pagar a conta de luz", due_on: new Date().toISOString().slice(0, 10), priority: "medium", status: "todo" });
    const a = await make();
    const before = apiCalls.length;
    const [r1, r2] = await Promise.all([runDueAutomations(), runDueAutomations()]);
    expect(r1.delivered + r2.delivered).toBe(1);
    expect(apiCalls.length - before).toBe(1);

    const call = apiCalls[before].body;
    expect(call.model).toBe("claude-sonnet-5-5");
    expect(call.tools).toBeUndefined();
    expect(call.system).toContain("revisão agendada");
    expect(call.messages[0].content).toContain("Pagar a conta de luz");  // os dados da pessoa vão no pedido
    expect(call.messages[0].content).toContain("Tarefas do dia");

    expect(await runs(a.id)).toEqual([expect.objectContaining({ status: "delivered", scheduled_for: expect.any(String) })]);
    const { data: notices } = await admin.from("notices").select("title, body, kind").eq("user_id", userId).eq("kind", "automation");
    expect(notices).toEqual([expect.objectContaining({ title: "Resumo da manhã", body: "*Seu dia*\n• Pagar a conta de luz hoje" })]);
    const { data: usage } = await admin.from("ai_usage").select("model, calls, input_tokens, output_tokens").eq("user_id", userId);
    expect(usage).toEqual([expect.objectContaining({ model: "claude-sonnet-5-5", calls: 1, input_tokens: 300, output_tokens: 40 })]);
    const { data: next } = await admin.from("automations").select("next_run_at, active").eq("id", a.id).single();
    expect(new Date(next!.next_run_at!).getTime()).toBeGreaterThan(Date.now());
    expect(next!.active).toBe(true);

    // de novo: ainda não é a hora
    const again = await runDueAutomations();
    expect(again.delivered).toBe(0);
    expect(apiCalls.length - before).toBe(1);
  });

  it("sem nada nas fontes escolhidas: não chama a IA e não incomoda", async () => {
    const { runDueAutomations } = await import("./automations");
    const a = await make({ title: "Metas", sources: ["goals"] });
    const before = apiCalls.length;
    const r = await runDueAutomations();
    expect(r.empty).toBe(1);
    expect(apiCalls.length).toBe(before);
    expect((await runs(a.id))[0].status).toBe("empty");
  });

  it("atrasada demais pula; uma vez só roda e desliga; WhatsApp sem vínculo cai no aviso do celular", async () => {
    const { runDueAutomations } = await import("./automations");
    const late = await make({ title: "Atrasada" }, 5 * 60);
    const before = apiCalls.length;
    expect((await runDueAutomations()).skipped).toBe(1);
    expect(apiCalls.length).toBe(before);
    expect(await runs(late.id)).toEqual([expect.objectContaining({ status: "skipped", error: "atrasada demais" })]);
    const { data: advanced } = await admin.from("automations").select("next_run_at").eq("id", late.id).single();
    expect(new Date(advanced!.next_run_at!).getTime()).toBeGreaterThan(Date.now());

    // hoje no fuso da pessoa, à meia-noite: já passou a qualquer hora do dia (antes, às 7h, falhava de madrugada)
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const once = await make({ title: "Uma vez", schedule: "once", run_on: day, run_time: "00:00", channel: "whatsapp" });
    const r = await runDueAutomations();
    expect(r.delivered).toBe(1);
    const row = (await runs(once.id))[0];
    expect(row.status).toBe("delivered");
    expect(row.error).toContain("WhatsApp não vinculado");
    const { data: after } = await admin.from("automations").select("active, next_run_at").eq("id", once.id).single();
    expect(after).toEqual({ active: false, next_run_at: null });
  });

  it("se a IA falhar, registra, avisa a pessoa e a revisão segue para o próximo horário", async () => {
    const { runDueAutomations } = await import("./automations");
    apiFails = true;
    try {
      const a = await make({ title: "Vai falhar" });
      const r = await runDueAutomations();
      expect(r.failed).toBe(1);
      const row = (await runs(a.id))[0];
      expect(row.status).toBe("failed");
      const { data: notices } = await admin.from("notices").select("title").eq("user_id", userId).eq("kind", "automation");
      expect(notices!.map((n) => n.title)).toContain("Vai falhar: não deu para montar");
      const { data: next } = await admin.from("automations").select("next_run_at, active").eq("id", a.id).single();
      expect(next!.active).toBe(true);
      expect(new Date(next!.next_run_at!).getTime()).toBeGreaterThan(Date.now());
    } finally { apiFails = false; }
  });

  it("pesquisa na web: manda a busca da Anthropic, continua depois da pausa, junta as fontes e conta as buscas no custo", async () => {
    const { runDueAutomations } = await import("./automations");
    const usage = (searches: number) => ({ input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: searches } });
    const searchBlocks = [
      { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "github trending" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://github.com/trending", title: "Trending", encrypted_content: "x", page_age: null }] },
    ];
    queued.push(
      { id: "msg_p1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "pause_turn", stop_sequence: null, content: searchBlocks, usage: usage(2) },
      { id: "msg_p2", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null, usage: usage(1), content: [
        { type: "text", text: "*GitHub hoje*\n• foo/bar subiu 2 mil estrelas", citations: [
          { type: "web_search_result_location", url: "https://github.com/trending", title: "Trending", encrypted_index: "e", cited_text: "foo/bar" },
          { type: "web_search_result_location", url: "https://github.com/trending", title: "Trending", encrypted_index: "e", cited_text: "repetida" },
        ] },
      ] },
    );
    const { data: oldUsage } = await admin.from("ai_usage").select("id").eq("user_id", userId);
    const a = await make({ title: "GitHub popular", instruction: "os repositórios mais populares do GitHub", sources: ["web"] });
    const before = apiCalls.length;
    expect((await runDueAutomations()).delivered).toBe(1);
    expect(apiCalls.length - before).toBe(2);  // pausou e continuou

    const first = apiCalls[before].body as unknown as { tools: Array<Record<string, unknown>>; system: string; messages: Array<{ role: string; content: unknown }> };
    expect(first.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" } }]);
    expect(first.system).toContain("pesquisa diária na internet");
    expect(JSON.stringify(first.messages[0].content)).toContain("os repositórios mais populares do GitHub");
    // a continuação leva o turno pausado de volta, sem mensagem nova da pessoa
    const second = apiCalls[before + 1].body as unknown as { messages: Array<{ role: string }> };
    expect(second.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const { data: notice } = await admin.from("notices").select("body").eq("user_id", userId).eq("title", "GitHub popular").single();
    expect(notice!.body).toBe("*GitHub hoje*\n• foo/bar subiu 2 mil estrelas\n\n*Fontes*\n• https://github.com/trending");
    const { data: rows } = await admin.from("ai_usage").select("calls, web_searches").eq("user_id", userId);
    expect(rows!.length).toBe(oldUsage!.length + 1);
    expect(rows!.at(-1)).toEqual({ calls: 2, web_searches: 3 });
    expect(await runs(a.id)).toEqual([expect.objectContaining({ status: "delivered" })]);
  });
});
