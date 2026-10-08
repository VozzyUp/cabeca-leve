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

    const first = requests[0];
    expect(first.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(first.body.model).toBe("claude-opus-5-5");
    expect(first.body.fallbacks).toBe("default");
    expect(first.body.output_config).toEqual({ effort: "low" });
    expect((first.body.tools as Array<{ strict?: boolean }>).every((t) => t.strict)).toBe(true);
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

  it("se a API falhar, fecha o turno com uma resposta e o histórico segue válido", async () => {
    const { runAgent } = await import("./agent");
    replies.push({ type: "error", error: { type: "invalid_request_error", message: "x" } });
    const r = await runAgent({ store, text: "teste de erro", channel: "web" });
    expect(r.text).toMatch(/Não consegui responder/);
    const t = await store.listTodayTranscript();
    expect(t.at(-1)!.role).toBe("assistant");
  });
});
