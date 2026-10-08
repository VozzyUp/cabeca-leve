// As 8 obrigatórias que fecharam depois do backend, no navegador, contra o Supabase local.
// Uso (com npm run db:start e npm run dev): node scripts/musts-check.cjs replica/clone-screens
const { chromium } = require('playwright');
const { createClient } = require(process.cwd() + '/node_modules/@supabase/supabase-js');
const out = process.argv[2];
const base = 'http://localhost:3000';
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU') + ' ' + m); if (!c) process.exitCode = 1; };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

(async () => {
  const admin = createClient('http://127.0.0.1:54321', (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const email = `obrig-${Date.now()}@exemplo.com.br`;
  const { data: created } = await admin.auth.admin.createUser({ email, password: 'senha-12345', email_confirm: true, user_metadata: { name: 'Lia' } });
  const b = await chromium.launch();
  const errors = [];
  const login = async (viewport) => {
    const ctx = await b.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/entrar');
    await p.getByLabel('E-mail').fill(email); await p.getByLabel('Senha').fill('senha-12345');
    await p.getByRole('button', { name: 'Entrar', exact: true }).last().click(); await p.waitForURL('**/conversa');
    return p;
  };
  try {
    const p = await login({ width: 1440, height: 900 });
    const phone = await login({ width: 390, height: 844 });

    // tempo real: o celular está em Tarefas; a tarefa criada no computador aparece sem recarregar
    await phone.goto(base + '/tarefas', { waitUntil: 'networkidle' });
    await phone.getByRole('radio', { name: /Sem prazo/ }).click();
    await p.evaluate(async () => fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Criada no computador', dueOn: null }) }));
    await phone.getByText('Criada no computador').waitFor({ timeout: 10000 });
    ok(true, 'tempo real: tarefa criada num aparelho aparece no outro sem recarregar');

    // tarefa recorrente + observações + apagar
    await p.goto(base + '/tarefas', { waitUntil: 'networkidle' });
    await p.getByLabel('Nova tarefa').fill('Regar as plantas');
    await p.getByLabel('Prazo').first().fill(today());
    await p.getByLabel('Repetir').selectOption({ label: 'Todo dia' });
    await Promise.all([p.waitForResponse((r) => r.url().endsWith('/api/tasks') && r.request().method() === 'POST'), p.getByRole('button', { name: 'Adicionar' }).click()]);
    ok((await p.getByText(/repete todo dia/).count()) === 1, 'tarefa nova mostra que repete');
    await Promise.all([p.waitForResponse((r) => r.url().includes('/api/tasks/') && r.request().method() === 'PATCH'), p.getByRole('checkbox', { name: /Regar as plantas/ }).click()]);
    await p.getByRole('radio', { name: /Próximas/ }).click();
    await p.getByText('Regar as plantas').waitFor({ timeout: 5000 });
    ok(true, 'concluir a tarefa que repete cria a de amanhã');
    await p.getByRole('button', { name: 'Editar Regar as plantas' }).click();
    ok(await p.getByRole('dialog', { name: 'Editar tarefa' }).isVisible(), 'janela de edição abre');
    await p.getByLabel('Observações').fill('Samambaia só um copo.');
    await Promise.all([p.waitForResponse((r) => r.request().method() === 'PATCH'), p.getByRole('button', { name: 'Salvar' }).click()]);
    await p.getByText(/com observações/).waitFor({ timeout: 5000 });
    ok(true, 'observação salva aparece na lista');
    await p.screenshot({ path: `${out}/S09-edicao-desktop.png` });
    await p.getByRole('button', { name: 'Editar Regar as plantas' }).click();
    await p.keyboard.press('Escape');
    ok(!(await p.getByRole('dialog').isVisible()), 'Esc fecha a janela');
    await p.getByRole('button', { name: 'Editar Regar as plantas' }).click();
    await Promise.all([p.waitForResponse((r) => r.request().method() === 'DELETE'), p.getByRole('button', { name: 'Apagar' }).click()]);
    ok((await p.getByText('Regar as plantas').count()) === 0, 'apagar tarefa');

    // lembrete que se repete pelo formulário
    await p.goto(base + '/lembretes', { waitUntil: 'networkidle' });
    const tomorrow = new Date(Date.now() + 86400000);
    await p.getByLabel('Novo lembrete').fill('Tomar vitamina');
    await p.getByLabel('Dia', { exact: true }).fill(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(tomorrow));
    await p.getByLabel('Hora', { exact: true }).fill('08:00');
    await p.getByLabel('Repetir').selectOption({ label: 'Todo dia' });
    await Promise.all([p.waitForResponse((r) => r.url().endsWith('/api/reminders') && r.request().method() === 'POST'), p.getByRole('button', { name: 'Criar' }).click()]);
    ok(await p.getByText('08:00 · repete todo dia').isVisible(), 'lembrete diário criado pela tela');
    await p.screenshot({ path: `${out}/S11-repeticao-desktop.png` });

    // categorias e subcategorias
    await p.goto(base + '/dinheiro/categorias', { waitUntil: 'networkidle' });
    await p.getByLabel('Nova categoria').fill('Padaria');
    await p.getByLabel('Dentro de').selectOption({ label: 'Alimentação' });
    await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Criar' }).click()]);
    await p.getByRole('button', { name: 'Editar Padaria' }).waitFor();
    ok(true, 'subcategoria criada dentro de Alimentação');
    await p.getByLabel('Nova categoria').fill('padaria');
    await p.getByLabel('Dentro de').selectOption({ label: 'Alimentação' });
    await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Criar' }).click()]);
    await p.getByText('Já existe uma categoria com esse nome aqui.').waitFor({ timeout: 5000 });
    ok(true, 'nome repetido é recusado');
    await p.screenshot({ path: `${out}/S18-categorias-desktop.png` });

    // gastos pela conversa e filtros do extrato
    await p.goto(base + '/conversa', { waitUntil: 'networkidle' });
    const box = p.getByLabel('Mensagem para o assistente');
    await box.fill('gastei 12 no pão de padaria no pix e recebi 300 de freela');
    await box.press('Enter');
    await p.getByText(/Pronto, tirei da sua cabeça/).waitFor({ timeout: 15000 });
    await p.goto(base + '/dinheiro/extrato', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: 'Saiu' }).click();
    ok(await p.getByText('−R$ 12,00').first().isVisible() && (await p.getByText('+R$ 300,00').count()) === 0, 'filtro "Saiu" esconde as entradas');
    await p.getByRole('radio', { name: 'Tudo' }).click();
    await p.getByLabel('Forma').selectOption('pix');
    ok(await p.getByText(/^1 lançamento/).isVisible(), 'filtro por forma de pagamento com total');
    await p.getByRole('button', { name: 'Limpar filtros' }).click();
    ok((await p.getByText(/R\$\s300,00/).count()) >= 1, 'limpar filtros');
    await p.screenshot({ path: `${out}/S24-filtros-desktop.png` });

    // áudio no app sem transcrição ligada: explica
    await p.goto(base + '/conversa', { waitUntil: 'networkidle' });
    await p.locator('input[type=file]').setInputFiles({ name: 'nota.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3fake') });
    await p.getByText(/Áudio ainda não está ligado|Não consegui entender/).waitFor({ timeout: 5000 });
    ok(true, 'enviar áudio sem a Groq configurada mostra o aviso');

    await phone.screenshot({ path: `${out}/S09-tempo-real-mobile.png` });
    ok(errors.length === 0, 'sem erros na página' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok(false, e.message.split('\n')[0]); }
  await b.close();
  await admin.auth.admin.deleteUser(created.user.id);
})();
