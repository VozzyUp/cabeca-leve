"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { billingEnabled, cancelSubscription, createCheckout } from "@/lib/billing/asaas";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { FOLDER_EXISTS } from "@/lib/data/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser, getAdmin } from "@/lib/supabase/server";
import { LinkLimitError, startLink } from "@/lib/whatsapp/link";
import { whatsappLimit } from "@/lib/limits";
import { answerTicket, isSupportAdmin } from "@/lib/support";
import { sendTestNotice } from "@/lib/deliveries";
import { confirmBill } from "@/lib/assistant/tools";
import { CONFIG_FIELDS, CONFIG_KEYS, loadAppConfig, saveAppConfig } from "@/lib/app-config";
import { pingAgent } from "@/lib/assistant/agent";
import { changeDocument, changeFolderDeadline } from "@/lib/documents";
import { storageLimitBytes } from "@/lib/limits";
import { isVapidPrivateKey, isVapidPublicKey, siteUrl } from "@/lib/public-env";
import type { DocFolder, Settings } from "@/lib/data/types";

// Ações de servidor das telas do M3 e M4. Cada uma valida a entrada, grava pelo DataStore
// e revalida a tela. No /replica-backend, todas passam a checar a sessão do usuário.

const uuid = z.uuid();
const day = z.iso.date();

export async function setRecurrenceActive(id: string, active: boolean) {
  await (await getStore()).setRecurrenceActive(uuid.parse(id), active);
  revalidatePath("/dinheiro/fixos");
}

export async function setMilestoneDone(projectId: string, milestoneId: string, done: boolean) {
  await (await getStore()).setMilestoneDone(uuid.parse(projectId), uuid.parse(milestoneId), done);
  revalidatePath("/projetos");
}

export async function addGoalProgress(id: string, delta: number) {
  await (await getStore()).addGoalProgress(uuid.parse(id), z.number().finite().parse(delta));
  revalidatePath("/metas");
}

const noteInput = z.object({
  title: z.string().trim().max(120),
  body: z.string().trim().max(20_000),
  notebook: z.string().trim().min(1).max(40),
  kind: z.enum(["note", "journal"]),
});

export async function createNote(input: z.input<typeof noteInput>) {
  const parsed = noteInput.parse(input);
  if (!parsed.title && !parsed.body) throw new Error("Nota vazia");
  const note = await (await getStore()).createNote(parsed);
  revalidatePath("/notas");
  return note;
}

export async function updateNote(id: string, patch: { title?: string; body?: string; pinned?: boolean }) {
  const parsed = z.object({ title: z.string().trim().max(120).optional(), body: z.string().max(20_000).optional(), pinned: z.boolean().optional() }).parse(patch);
  await (await getStore()).updateNote(uuid.parse(id), parsed);
  revalidatePath("/notas");
}

export async function setAutomationActive(id: string, active: boolean) {
  await (await getStore()).setAutomationActive(uuid.parse(id), active);
  revalidatePath("/automacoes");
}

// Por onde a revisão ou pesquisa chega: notificação, WhatsApp ou e-mail
export async function setAutomationChannel(id: string, channel: string) {
  await (await getStore()).setAutomationChannel(uuid.parse(id), z.enum(["push", "whatsapp", "email"]).parse(channel));
  revalidatePath("/automacoes");
}

export async function markNoticesRead(ids: string[] | "all") {
  await (await getStore()).markNoticesRead(ids === "all" ? "all" : z.array(uuid).parse(ids));
  revalidatePath("/avisos");
}

export async function saveFocusSession(input: { title: string; minutes: number; startedAt: string; finishedAt: string | null }) {
  const parsed = z.object({
    title: z.string().trim().min(1).max(200), minutes: z.number().int().min(1).max(240),
    startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().nullable(),
  }).parse(input);
  await (await getStore()).saveFocusSession(parsed);
  revalidatePath("/foco");
}

export async function setWorkoutDone(workoutId: string, onDay: string, done: boolean) {
  await (await getStore()).setWorkoutDone(uuid.parse(workoutId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function setMealDone(mealId: string, onDay: string, done: boolean) {
  await (await getStore()).setMealDone(uuid.parse(mealId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function addMeasurement(input: { day: string; weightKg: number | null; waistCm: number | null; hipCm: number | null }) {
  const n = (min: number, max: number) => z.number().min(min).max(max).nullable();
  const parsed = z.object({ day, weightKg: n(20, 400), waistCm: n(30, 250), hipCm: n(30, 250) }).parse(input);
  if (parsed.weightKg === null && parsed.waistCm === null && parsed.hipCm === null) throw new Error("Medida vazia");
  await (await getStore()).addMeasurement(parsed);
  revalidatePath("/saude", "layout");
}

const settingsPatch = z.object({
  name: z.string().trim().min(1).max(80),
  tone: z.enum(["direct", "warm", "playful", "tough"]),
  answerLength: z.enum(["short", "detailed"]),
  voice: z.enum(["female", "male"]),
  memoryEnabled: z.boolean(),
  theme: z.enum(["dark", "light", "system"]),
  briefingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  channels: z.object({ whatsapp: z.string().regex(/^\+\d{10,15}$/).nullable(), telegram: z.boolean(), email: z.boolean(), push: z.boolean() }),
  calendars: z.object({ google: z.boolean(), outlook: z.boolean() }),
  onboarded: z.boolean(),
}).partial();

export async function updateSettings(patch: Partial<Settings>) {
  const parsed = settingsPatch.parse(patch);
  const s = await (await getStore()).updateSettings(parsed);
  revalidatePath("/", "layout");
  return s;
}

export async function setCalendarConnected(source: "google" | "outlook", connected: boolean) {
  const store = await getStore();
  const { calendars } = await store.getSettings();
  await store.updateSettings({ calendars: { ...calendars, [z.enum(["google", "outlook"]).parse(source)]: connected } });
  revalidatePath("/", "layout");
}

export async function setHabitDay(habitId: string, onDay: string, done: boolean) {
  const parsed = day.parse(onDay);
  if (parsed > new Date().toISOString().slice(0, 10) && done) throw new Error("Dia no futuro");
  await (await getStore()).setHabitDone(uuid.parse(habitId), parsed, done);
  revalidatePath("/habitos", "layout");
}

// Portabilidade (LGPD): tudo do usuário num JSON
export async function exportData() {
  const s = await getStore();
  const [settings, tasks, reminders, habits, habitLogs, transactions, categories, accounts, cards, recurrences, installments,
    projects, goals, notes, automations, notices, focusSessions, workouts, workoutLogs, meals, mealLogs, measurements, messages, memories] = await Promise.all([
    s.getSettings(), s.listTasks(), s.listReminders(), s.listHabits(), s.listHabitLogs(), s.listTransactions(), s.listCategories(),
    s.listAccounts(), s.listCards(), s.listRecurrences(), s.listInstallments(), s.listProjects(), s.listGoals(), s.listNotes(),
    s.listAutomations(), s.listNotices(), s.listFocusSessions(), s.listWorkouts(), s.listWorkoutLogs(), s.listMeals(), s.listMealLogs(),
    s.listMeasurements(), s.listMessages(), s.listMemories(),
  ]);
  // cofre: só cifrado (abre com a senha mestra, lib/vault-crypto.ts)
  const vaultMeta = await s.getVault();
  const vault = vaultMeta ? { ...vaultMeta, items: await s.listVaultItems(), aviso: "cifrado com a senha mestra (PBKDF2-SHA256 + AES-GCM)" } : null;
  // documentos: os dados de cada um; os arquivos originais se baixam um a um na tela Documentos
  const [documentFolders, documents] = await Promise.all([s.listDocFolders(), s.listDocuments()]);
  return JSON.stringify({
    exportedAt: new Date().toISOString(), settings, tasks, reminders, habits, habitLogs, transactions, categories, accounts, cards,
    recurrences, installments, projects, goals, notes, automations, notices, focusSessions, workouts, workoutLogs, meals, mealLogs,
    measurements, messages, memories, vault, documentFolders, documents,
    avisoDocumentos: documents.length ? "os arquivos originais (fotos e PDFs) são baixados na tela Documentos" : undefined,
  }, null, 2);
}

// Memória do assistente (Ajustes > Jeito do assistente): esquecer um fato ou todos
// "A resolver" (Dinheiro): confirma uma conta fixa paga ou entrada recebida
export async function confirmBillAction(recurrenceId: string, dueOn: string) {
  const store = await getStore();
  const r = await confirmBill(store, uuid.parse(recurrenceId), day.parse(dueOn), new Date());
  revalidatePath("/dinheiro", "layout");
  if (!r.ok) throw new Error(r.text);
  return { ok: true as const };
}

export async function deleteMemory(id: string) {
  const ok = await (await getStore()).removeItem("memory", uuid.parse(id));
  revalidatePath("/ajustes/assistente");
  return { ok };
}
export async function clearMemories() {
  const count = await (await getStore()).clearMemories();
  revalidatePath("/ajustes/assistente");
  return { count };
}

export async function deleteAccount(confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "EXCLUIR") throw new Error("Confirmação errada");
  await (await getStore()).deleteAllData();
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// Vincular um WhatsApp: com Supabase, gera o código que a pessoa manda do próprio celular;
// no modo de demonstração, só guarda o número. A conta pode ter vários (casal, família),
// até o limite do plano, cada um com o nome de quem usa.
const waLabel = z.string().trim().min(1).max(40).nullable().optional();
export async function linkWhatsApp(number: string, label?: string | null) {
  const n = z.string().regex(/^\+\d{12,13}$/).parse(number);
  const name = waLabel.parse(label ?? null);
  if (!isSupabaseConfigured()) {
    const store = await getStore();
    const { channels } = await store.getSettings();
    await store.updateSettings({ channels: { ...channels, whatsapp: n } });
    revalidatePath("/ajustes");
    return null;
  }
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  const { plan } = await (await getStore()).getSettings();
  try {
    const result = await startLink(user.id, n, { label: name, limit: whatsappLimit(plan) });
    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error instanceof LinkLimitError) return { limitReached: error.limit };
    throw error;
  }
}

// Nome de quem usa o número e se ele recebe os avisos (lembretes, resumo, suporte)
export async function updateWhatsApp(id: string, patch: { label?: string | null; receivesNotices?: boolean }) {
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  const row: { label?: string | null; receives_notices?: boolean } = {};
  if (patch.label !== undefined) row.label = waLabel.parse(patch.label);
  if (patch.receivesNotices !== undefined) row.receives_notices = z.boolean().parse(patch.receivesNotices);
  const { error } = await getAdmin().from("channel_links").update(row).eq("id", uuid.parse(id)).eq("user_id", user.id).eq("channel", "whatsapp");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Desvincular: o número para de falar com a conta na hora
export async function unlinkWhatsApp(id: string) {
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  const { error } = await getAdmin().from("channel_links").delete().eq("id", uuid.parse(id)).eq("user_id", user.id).eq("channel", "whatsapp");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Abre a página de pagamento da Asaas para o plano escolhido
export async function startCheckout(plan: "monthly" | "yearly") {
  const p = z.enum(["monthly", "yearly"]).parse(plan);
  const user = await currentUser();
  if (!user) redirect(`/entrar?modo=criar&plano=${p}`);
  if (!billingEnabled()) throw new Error("Cobrança não configurada");
  const settings = await (await getStore()).getSettings();
  redirect(await createCheckout(user.id, p, settings.trialEndsOn));
}

// Cancelar em um toque: para de cobrar e o acesso vale até o fim do período pago
export async function cancelPlan() {
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  await cancelSubscription(user.id);
  revalidatePath("/", "layout");
}

// Categorias (S18 > Categorias): criar, renomear e arquivar
const categoryName = z.string().trim().min(1, "Dê um nome").max(60);

export async function createCategory(input: { name: string; kind: "expense" | "income"; parentId: string | null }) {
  const parsed = z.object({ name: categoryName, kind: z.enum(["expense", "income"]), parentId: uuid.nullable() }).parse(input);
  const store = await getStore();
  const existing = await store.listCategories();
  if (existing.some((c) => c.name.toLocaleLowerCase("pt-BR") === parsed.name.toLocaleLowerCase("pt-BR") && (c.parentId ?? null) === parsed.parentId)) {
    return { ok: false as const, error: "Já existe uma categoria com esse nome aqui." };
  }
  await store.createCategory(parsed);
  revalidatePath("/dinheiro", "layout");
  return { ok: true as const };
}

export async function renameCategory(id: string, name: string) {
  await (await getStore()).updateCategory(uuid.parse(id), { name: categoryName.parse(name) });
  revalidatePath("/dinheiro", "layout");
}

export async function archiveCategory(id: string) {
  await (await getStore()).archiveCategory(uuid.parse(id));
  revalidatePath("/dinheiro", "layout");
}

// F3: falar com uma pessoa. Abre o chamado (protocolo e prazo) e avisa o time.
export async function openSupport(message: string) {
  const text = z.string().trim().min(5, "Conte um pouco mais").max(4000).parse(message);
  const ticket = await (await getStore()).openSupportTicket(text, "web");
  revalidatePath("/ajustes/suporte");
  return ticket;
}

// Painel do time: só e-mails em ADMIN_EMAILS respondem
export async function answerSupport(ticketId: string, reply: string) {
  const user = await currentUser();
  if (!user || !isSupportAdmin(user.email)) throw new Error("Sem permissão");
  const ok = await answerTicket(uuid.parse(ticketId), z.string().trim().min(1).max(4000).parse(reply), user.email!);
  revalidatePath("/suporte/painel");
  return ok;
}

// F6: testar os avisos agora (push e WhatsApp), com o resultado de cada canal
export async function testNotice() {
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  return sendTestNotice(user.id);
}

// ---- Configuração do sistema (/admin/configuracoes): só ADMIN_EMAILS ----
async function requireAdmin() {
  const user = await currentUser();
  if (!user || !isSupportAdmin(user.email)) throw new Error("Sem permissão");
  return user.email!;
}

export async function saveSystemConfig(changes: Record<string, string | null>) {
  const by = await requireAdmin();
  const clean: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(changes)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`Campo desconhecido: ${key}`);
    if (raw === null) { clean[key] = null; continue; }
    const value = z.string().trim().min(1).max(4000).parse(raw);
    const options = CONFIG_FIELDS.get(key)?.options;
    if (options && !options.includes(value)) throw new Error(`${key}: escolha uma das opções da lista`);
    if (key === "COST_USD_BRL" && !(Number(value.replace(",", ".")) > 0)) throw new Error("COST_USD_BRL: use um número, por exemplo 5.50");
    if (key.endsWith("_URL") && !/^https?:\/\/\S+$/.test(value)) throw new Error(`${key}: use um endereço que comece com https://`);
    if (key === "VAPID_PUBLIC_KEY" && !isVapidPublicKey(value)) throw new Error("Chave pública: isso não é uma chave VAPID. Use o botão Gerar, que cria e salva as duas chaves.");
    if (key === "VAPID_PRIVATE_KEY" && !isVapidPrivateKey(value)) throw new Error("Chave privada: isso não é uma chave VAPID. Use o botão Gerar, que cria e salva as duas chaves.");
    clean[key] = value;
  }
  await saveAppConfig(clean, by);
  revalidatePath("/admin/configuracoes");
  return { ok: true as const };
}

// Gera e grava um segredo aleatório (tokens de webhook) ou o par de chaves do push
export async function generateSystemSecret(kind: "hex32" | "vapid", key: string) {
  const by = await requireAdmin();
  if (kind === "vapid") {
    const { default: webpush } = await import("web-push");
    const k = webpush.generateVAPIDKeys();
    await saveAppConfig({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey }, by);
  } else {
    if (!CONFIG_KEYS.has(key)) throw new Error("Campo desconhecido");
    await saveAppConfig({ [key]: (await import("node:crypto")).randomBytes(24).toString("hex") }, by);
  }
  revalidatePath("/admin/configuracoes");
  return { ok: true as const };
}

// Testa a chave da Anthropic com uma chamada mínima e devolve o motivo se falhar
export async function testAnthropicKey() {
  await requireAdmin();
  await loadAppConfig(true);
  return pingAgent();
}

// Endereços para colar na UAZAPI, na Asaas e na Meta (com os tokens), só para o admin
export async function revealIntegrationInfo() {
  await requireAdmin();
  await loadAppConfig(true);
  const site = siteUrl();
  const e = process.env;
  return {
    whatsappWebhook: e.UAZAPI_WEBHOOK_SECRET ? `${site}/api/webhooks/whatsapp?secret=${e.UAZAPI_WEBHOOK_SECRET}` : null,
    asaasWebhook: `${site}/api/webhooks/asaas`,
    asaasToken: e.ASAAS_WEBHOOK_TOKEN ?? null,
    metaCallback: `${site}/api/webhooks/whatsapp`,
    metaVerifyToken: e.META_WEBHOOK_VERIFY_TOKEN ?? null,
  };
}

// ---- Cofre de senhas: o aparelho cifra e decifra; aqui só passa texto cifrado (base64) ----
const b64 = (min: number, max: number) => z.string().min(min).max(max).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const sealedSchema = z.object({ iv: b64(12, 32), ciphertext: b64(16, 20000) });
const vaultMetaSchema = z.object({ salt: b64(16, 64), iterations: z.number().int().min(100_000).max(5_000_000), verifier: z.object({ iv: b64(12, 32), ciphertext: b64(16, 200) }) });
const MAX_VAULT_ITEMS = 500;

export async function loadVault() {
  const store = await getStore();
  const meta = await store.getVault();
  return { meta, items: meta ? await store.listVaultItems() : [] };
}

export async function createVault(meta: z.infer<typeof vaultMetaSchema>) {
  const store = await getStore();
  if (await store.getVault()) throw new Error("O cofre já existe");
  await store.setupVault(vaultMetaSchema.parse(meta));
}

export async function saveVaultItem(id: string | null, sealed: z.infer<typeof sealedSchema>) {
  const store = await getStore();
  if (!(await store.getVault())) throw new Error("Crie o cofre antes");
  if (!id && (await store.listVaultItems()).length >= MAX_VAULT_ITEMS) throw new Error(`O cofre guarda até ${MAX_VAULT_ITEMS} itens`);
  return store.saveVaultItem(id === null ? null : uuid.parse(id), sealedSchema.parse(sealed));
}

export async function deleteVaultItem(id: string) {
  return (await getStore()).deleteVaultItem(uuid.parse(id));
}

export async function changeVaultPassword(meta: z.infer<typeof vaultMetaSchema>, items: Array<{ id: string } & z.infer<typeof sealedSchema>>) {
  const parsed = z.array(sealedSchema.extend({ id: uuid })).max(MAX_VAULT_ITEMS).parse(items);
  await (await getStore()).rekeyVault(vaultMetaSchema.parse(meta), parsed);
}

// Esqueceu a senha mestra: não há como recuperar; apagar tudo deixa começar de novo
export async function destroyVault(confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "APAGAR") throw new Error("Confirmação errada");
  await (await getStore()).deleteVault();
}

// ---- Documentos (notas fiscais, recibos, pedidos médicos) ----

export async function loadDocuments() {
  const store = await getStore();
  const [folders, documents, usedBytes, settings] = await Promise.all([store.listDocFolders(), store.listDocuments(), store.documentBytesUsed(), store.getSettings()]);
  return { folders, documents, usedBytes, limitBytes: storageLimitBytes(settings.plan), timezone: store.timezone() };
}

const folderName = z.string().trim().min(1, "Dê um nome para a pasta.").max(80, "Nome grande demais (até 80 letras).");
const deadlineDays = z.number().int().min(1).max(730).nullable();

// Erro esperado (nome repetido) volta como resultado: uma ação que lança tem a mensagem escondida em produção
export type FolderResult = { ok: true; folder: DocFolder | null } | { ok: false; error: string };

export async function createDocFolder(input: { name: string; deadlineDays: number | null }): Promise<FolderResult> {
  const parsed = z.object({ name: folderName, deadlineDays }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const folder = await (await getStore()).createDocFolder(parsed.data);
    revalidatePath("/documentos");
    return { ok: true, folder };
  } catch (error) {
    if (error instanceof Error && error.message === FOLDER_EXISTS) return { ok: false, error: FOLDER_EXISTS };
    throw error;
  }
}

export async function updateDocFolder(id: string, input: { name?: string; deadlineDays?: number | null }): Promise<FolderResult> {
  const parsed = z.object({ name: folderName.optional(), deadlineDays: deadlineDays.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const store = await getStore();
  const folderId = uuid.parse(id);
  try {
    if (parsed.data.name !== undefined) await store.updateDocFolder(folderId, { name: parsed.data.name });
    if (parsed.data.deadlineDays !== undefined) await changeFolderDeadline(store, folderId, parsed.data.deadlineDays);
  } catch (error) {
    if (error instanceof Error && error.message === FOLDER_EXISTS) return { ok: false, error: FOLDER_EXISTS };
    throw error;
  }
  revalidatePath("/documentos");
  return { ok: true, folder: null };
}

export async function deleteDocFolder(id: string) {
  await (await getStore()).deleteDocFolder(uuid.parse(id));
  revalidatePath("/documentos");
}

const docPatch = z.object({
  folderId: uuid.nullable().optional(),
  title: z.string().trim().min(1, "O documento precisa de um nome.").max(120).optional(),
  issuer: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
  beneficiary: z.string().trim().max(80).nullable().optional().transform((v) => v || null),
  category: z.string().trim().max(60).nullable().optional().transform((v) => v || null),
  docDate: day.nullable().optional(),
  amountCents: z.number().int().min(0).max(100_000_000_00).nullable().optional(),
  status: z.enum(["pending", "submitted", "reimbursed"]).nullable().optional(),
  dueOn: day.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional().transform((v) => v || null),
});

export async function updateDocument(id: string, patch: z.input<typeof docPatch>) {
  const parsed = docPatch.parse(patch);
  // campos ausentes não entram (o transform acima viraria null)
  const given = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in patch));
  const doc = await changeDocument(await getStore(), uuid.parse(id), given);
  revalidatePath("/documentos");
  return doc;
}

export async function setDocumentsStatus(ids: string[], status: "pending" | "submitted" | "reimbursed" | null) {
  const list = z.array(uuid).min(1).max(200).parse(ids);
  const value = z.enum(["pending", "submitted", "reimbursed"]).nullable().parse(status);
  const store = await getStore();
  for (const id of list) await changeDocument(store, id, { status: value });
  revalidatePath("/documentos");
}

export async function deleteDocument(id: string) {
  await (await getStore()).deleteDocument(uuid.parse(id));
  revalidatePath("/documentos");
}
