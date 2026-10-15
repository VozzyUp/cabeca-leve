import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { a11y, admin, createUser, expect, login, mockCalls, noHorizontalScroll, test } from "./fixtures";

async function samplePdf(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 300]);
  return Buffer.from(await doc.save());
}
const samplePng = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#cccccc" } }).png().toBuffer();

test.describe("Documentos", () => {
  test("DOC-H1 cria pasta com prazo, guarda foto e PDF, edita, filtra, marca como enviado e baixa o original @celular", async ({ page, user }) => {
    await login(page, user, "/documentos");
    await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
    await expect(page.getByText("Nenhum documento ainda")).toBeVisible();
    expect(await a11y(page)).toEqual([]);

    // pasta com prazo padrão de 30 dias
    await page.getByRole("button", { name: "Nova pasta" }).click();
    const folderDialog = page.getByRole("dialog");
    await folderDialog.getByLabel("Nome da pasta").fill("Convênio");
    await folderDialog.getByLabel(/Prazo para pedir o reembolso/).fill("30");
    await folderDialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("button", { name: /Convênio \(0\)/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Nova pasta" }).click();
    await page.getByRole("dialog").getByLabel("Nome da pasta").fill("convênio");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Já existe uma pasta com esse nome." })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    // foto (na pasta aberta): abre a edição para conferir os dados
    await page.getByLabel("Escolher fotos ou PDFs").setInputFiles({ name: "nota-roberta.png", mimeType: "image/png", buffer: await samplePng() });
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("Nome")).toHaveValue("nota-roberta", { timeout: 30_000 });
    await edit.getByLabel("Nome").fill("Consulta Dra. Roberta");
    await edit.getByLabel("Emitido por").fill("Dra. Roberta Lima");
    await edit.getByLabel("Para quem").fill("Ana");
    await edit.getByLabel("Data do documento").fill("2026-10-10");
    await edit.getByLabel("Valor (R$)").fill("350");
    await edit.getByRole("button", { name: "Salvar" }).click();
    const row = page.getByRole("button", { name: "Abrir Consulta Dra. Roberta" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Dra. Roberta Lima · para Ana");
    await expect(row).toContainText("Pendente");
    await expect(row).toContainText("R$ 350,00");
    await expect(row).toContainText(/vence|venceu/);  // 10/10 + 30 dias, pelo prazo da pasta

    // PDF marcado como "só guardar": fica fora da conta de reembolso
    await page.getByLabel("Só guardar o próximo envio").check();
    await page.getByLabel("Escolher fotos ou PDFs").setInputFiles({ name: "pedido-ressonancia.pdf", mimeType: "application/pdf", buffer: await samplePdf() });
    await page.getByRole("dialog").getByLabel("Nome").fill("Pedido de ressonância");
    await expect(page.getByRole("dialog").getByLabel("Reembolso")).toHaveValue("stored");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await page.getByLabel("Só guardar o próximo envio").uncheck();
    await expect(page.getByRole("button", { name: "Abrir Pedido de ressonância" })).toContainText("Só guardado");

    // um recibo comum, sem pasta aberta nem leitura da IA: entra como pendente
    await page.getByRole("button", { name: /Todas \(2\)/ }).click();
    await page.getByLabel("Escolher fotos ou PDFs").setInputFiles({ name: "jantar.pdf", mimeType: "application/pdf", buffer: await samplePdf(2) });
    const dinner = page.getByRole("dialog");
    await dinner.getByLabel("Nome").fill("Jantar em SP");
    await dinner.getByLabel("Valor (R$)").fill("187,50");
    await dinner.getByLabel("Pasta").selectOption({ label: "Convênio" });
    await dinner.getByRole("button", { name: "Salvar" }).click();

    // resumo por status (o "só guardado" não entra na soma)
    const pendente = page.getByRole("button", { name: /Pendente/ }).first();
    await expect(pendente).toContainText("R$ 537,50");
    await expect(pendente).toContainText("2 documentos");

    // busca pelo nome do médico, sem acento nem caixa
    await page.getByLabel("Buscar nos documentos").fill("ROBERTA");
    await expect(page.getByRole("list", { name: "Documentos" }).getByRole("listitem")).toHaveCount(1);
    await page.getByLabel("Buscar nos documentos").fill("");

    // marca os dois pendentes como enviados de uma vez
    await page.getByLabel("Selecionar Consulta Dra. Roberta").check();
    await page.getByLabel("Selecionar Jantar em SP").check();
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByRole("button", { name: /Enviado/ }).first()).toContainText("2 documentos");
    await page.getByRole("group", { name: "Filtrar por situação" }).getByRole("button", { name: "Pendentes" }).click();
    await expect(page.getByText("Nada por aqui")).toBeVisible();
    await page.getByRole("group", { name: "Filtrar por situação" }).getByRole("button", { name: "Enviados" }).click();
    await expect(page.getByRole("list", { name: "Documentos" }).getByRole("listitem")).toHaveCount(2);

    // o original volta inteiro: o PDF byte a byte; a foto guardada como JPEG legível
    const { data: rows } = await admin.from("documents").select("id, title, mime_type, file_path, size_bytes").eq("user_id", user.id);
    expect(rows).toHaveLength(3);
    const pdfRow = rows!.find((r) => r.title === "Jantar em SP")!;
    const res = await page.request.get(`/api/documents/${pdfRow.id}/file?download=1`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="jantar\.pdf"/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBe(pdfRow.size_bytes);
    const pngRow = rows!.find((r) => r.title === "Consulta Dra. Roberta")!;
    const img = await page.request.get(`/api/documents/${pngRow.id}/file`);
    expect(img.headers()["content-type"]).toBe("image/jpeg");
    expect(img.headers()["content-disposition"]).toMatch(/^inline/);
    expect((await sharp(await img.body()).metadata()).width).toBe(800);

    // de dentro do app: abrir o original pela edição
    await page.getByRole("button", { name: "Abrir Jantar em SP" }).click();
    await expect(page.getByRole("link", { name: "Abrir o original" })).toHaveAttribute("href", `/api/documents/${pdfRow.id}/file`);
    expect(await a11y(page)).toEqual([]);
    await page.getByRole("button", { name: "Fechar" }).click();
    expect(await noHorizontalScroll(page)).toBe(true);

    // sai da pasta ao apagá-la; o documento continua, só que sem pasta
    await page.getByRole("button", { name: /Convênio \(\d+\)/ }).click();
    await page.getByRole("button", { name: "Editar pasta" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Apagar pasta" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Apagar", exact: true }).click();
    await expect(page.getByRole("button", { name: /Sem pasta \(3\)/ })).toBeVisible();

    // apagar um documento leva o arquivo do Storage
    await page.getByRole("button", { name: "Abrir Jantar em SP" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Apagar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Apagar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Abrir Jantar em SP" })).toHaveCount(0);
    expect((await admin.storage.from("documents").list(user.id)).data).toHaveLength(2);
  });

  test.describe("espaço", () => {
    // o navegador registra no console a resposta 409 (espaço cheio) que a tela trata e mostra
    test.use({ allowConsole: [/status of 409/] });
    test("DOC-E1 recusa arquivo de tipo errado, PDF falso e espaço cheio, com mensagem clara", async ({ page, user }) => {
    await login(page, user, "/documentos");
    await page.getByRole("button", { name: "Enviar o primeiro" }).waitFor();
    // a tela só oferece foto e PDF; a rota recusa o resto mesmo assim
    const bad = await page.request.post("/api/documents", { multipart: { file: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("oi") } } });
    expect(bad.status()).toBe(415);
    expect((await bad.json()).error).toMatch(/foto .* e PDF/);
    const fake = await page.request.post("/api/documents", { multipart: { file: { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>não sou pdf</html>") } } });
    expect(fake.status()).toBe(400);
    expect((await fake.json()).error).toMatch(/danificado/);
    expect((await page.request.post("/api/documents", { multipart: {} })).status()).toBe(400);
    const noFolder = await page.request.post("/api/documents", { multipart: { folderId: "00000000-0000-4000-8000-000000000000", file: { name: "a.pdf", mimeType: "application/pdf", buffer: await samplePdf() } } });
    expect(noFolder.status()).toBe(400);

    // espaço cheio: 100 MB no teste grátis. Enche o limite direto no banco (sem subir 100 MB) e tenta mais um.
    const { data: big } = await admin.from("documents").insert({
      user_id: user.id, title: "Cheio", file_path: `${user.id}/enchimento.pdf`, file_name: "cheio.pdf", mime_type: "application/pdf", size_bytes: 25 * 1024 * 1024, status: null,
    }).select("id").single();
    for (let i = 0; i < 3; i++) await admin.from("documents").insert({ user_id: user.id, title: `Cheio ${i}`, file_path: `${user.id}/enchimento-${i}.pdf`, file_name: "cheio.pdf", mime_type: "application/pdf", size_bytes: 25 * 1024 * 1024, status: null });
    expect(big).toBeTruthy();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/Espaço usado: 100 MB de 100 MB/)).toBeVisible();
    await page.getByLabel("Escolher fotos ou PDFs").setInputFiles({ name: "mais.pdf", mimeType: "application/pdf", buffer: await samplePdf() });
    await expect(page.getByRole("alert").filter({ hasText: /espaço para documentos está cheio/ })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /assine um plano/ })).toBeVisible();
    expect((await admin.from("documents").select("id").eq("user_id", user.id)).data).toHaveLength(4);  // nada novo foi gravado
  });
  });

  test("DOC-X1 outra conta não vê, não baixa e não altera os documentos; sem login é barrado", async ({ browser, page, user }) => {
    await login(page, user, "/documentos");
    const upload = await page.request.post("/api/documents", { multipart: { file: { name: "segredo.pdf", mimeType: "application/pdf", buffer: await samplePdf() } } });
    expect(upload.status()).toBe(200);
    const { document: doc } = await upload.json();

    const other = await createUser("Bia");
    const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const pb = await ctx.newPage();
    try {
      await login(pb, other, "/documentos");
      await expect(pb.getByText("segredo")).toHaveCount(0);
      expect((await pb.request.get(`/api/documents/${doc.id}/file`)).status()).toBe(404);
      expect((await pb.request.get("/api/documents/nao-e-um-id/file")).status()).toBe(404);
      const folderOfA = await admin.from("document_folders").insert({ user_id: user.id, name: "Da Ana" }).select("id").single();
      const intrusion = await pb.request.post("/api/documents", { multipart: { folderId: folderOfA.data!.id, file: { name: "x.pdf", mimeType: "application/pdf", buffer: await samplePdf() } } });
      expect(intrusion.status()).toBe(400);  // a pasta da Ana não existe para a Bia
    } finally {
      await admin.auth.admin.deleteUser(other.id);
      await ctx.close();
    }
    const anonymous = await (await browser.newContext()).request.get(`http://localhost:3000/api/documents/${doc.id}/file`);
    expect(anonymous.status()).toBe(401);
    // o dono continua baixando
    expect((await page.request.get(`/api/documents/${doc.id}/file`)).status()).toBe(200);
  });
});

// WhatsApp -> Documentos: o PDF mandado como arquivo chega pelo webhook, é guardado (sem IA, o e2e não tem chave)
// e aparece no app com o original disponível. Com a IA ligada, quem decide a pasta é o assistente (testado em agent.int.test.ts).
test("DOC-W1 PDF enviado pelo WhatsApp aparece em Documentos e o original baixa igual", async ({ page, user }) => {
  const number = `55119${String(Date.now()).slice(-8)}`;
  await admin.from("channel_links").insert({ user_id: user.id, channel: "whatsapp", external_id: `+${number}`, verified_at: new Date().toISOString() });
  const res = await fetch("http://localhost:3000/api/webhooks/whatsapp?secret=segredo-e2e", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ EventType: "messages", token: "token-e2e", message: {
      messageid: `DOC-${number}`, id: "DOC-REF", chatid: `${number}@s.whatsapp.net`, sender_pn: `${number}@s.whatsapp.net`, fromMe: false, isGroup: false, wasSentByApi: false,
      messageType: "DocumentMessage", content: { mimetype: "application/pdf", fileName: "nota-hotel.pdf" }, messageTimestamp: Date.now(),
    } }),
  });
  expect(res.status).toBe(200);
  await expect.poll(async () => (await mockCalls()).some((c) => c.url === "/send/text" || c.url === "/send/menu" ? String(c.body.number) === number && /Guardei em Documentos/.test(String(c.body.text)) : false), { timeout: 20_000 }).toBe(true);

  await login(page, user, "/documentos");
  const row = page.getByRole("button", { name: "Abrir nota-hotel" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Pendente");
  const { data } = await admin.from("documents").select("id, source, size_bytes").eq("user_id", user.id).single();
  expect(data!.source).toBe("whatsapp");
  const original = await (await fetch("http://127.0.0.1:4010/files/nota-hotel.pdf")).arrayBuffer();
  const res2 = await page.request.get(`/api/documents/${data!.id}/file?download=1`);
  expect(Buffer.from(await res2.body()).equals(Buffer.from(original))).toBe(true);
});
