// Cadastro, confirmação por e-mail, entrar, sair e senha nova, contra o Supabase local
// (npx supabase start) e o npm run dev com .env.local apontando para ele.
// Uso: node scripts/auth-check.cjs
const { chromium } = require('playwright');
const base = 'http://localhost:3000';
const mailpit = 'http://127.0.0.1:54324/api/v1';
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU') + ' ' + m); if (!c) process.exitCode = 1; };

async function lastLinkTo(email, pattern) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${mailpit}/search?query=${encodeURIComponent('to:' + email)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${mailpit}/message/${list.messages[0].ID}`)).json();
      const links = [...(msg.HTML || msg.Text).matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      const link = links.find((l) => pattern.test(l));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('e-mail não chegou para ' + email);
}

(async () => {
  const email = `teste-${Date.now()}@exemplo.com.br`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));

  await p.goto(base + '/tarefas');
  ok(p.url().includes('/entrar?voltar=%2Ftarefas'), 'sem sessão, a tela manda para o login');

  await p.getByRole('radio', { name: 'Criar conta' }).click();
  await p.getByLabel('Seu nome').fill('Teste');
  await p.getByLabel('E-mail').fill(email);
  await p.getByLabel('Senha').fill('uma-senha-boa-123');
  await p.getByRole('button', { name: 'Criar conta' }).last().click();
  await p.getByText('Quase lá').waitFor();
  ok(true, 'criar conta pede a confirmação por e-mail');

  await p.goto(base + '/entrar');
  await p.getByLabel('E-mail').fill(email);
  await p.getByLabel('Senha').fill('uma-senha-boa-123');
  await p.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await p.getByText('Confirme o e-mail antes de entrar').waitFor();
  ok(true, 'entrar antes de confirmar explica o motivo');

  const confirm = await lastLinkTo(email, /verify/);
  await p.goto(confirm);
  await p.waitForURL('**/conversa');
  ok(true, 'o link do e-mail ativa a conta e já entra');

  await p.goto(base + '/tarefas', { waitUntil: 'networkidle' });
  ok(await p.getByText('Nada para hoje').isVisible(), 'conta nova começa vazia');
  await p.getByLabel('Nova tarefa').fill('Primeira tarefa de verdade');
  await Promise.all([p.waitForResponse((r) => r.url().includes('/api/tasks') && r.request().method() === 'POST'), p.getByRole('button', { name: 'Adicionar' }).click()]);
  await p.getByRole('radio', { name: /Sem prazo/ }).click();
  ok(await p.getByText('Primeira tarefa de verdade').isVisible(), 'tarefa gravada no Supabase');

  await p.goto(base + '/conversa', { waitUntil: 'networkidle' });
  const box = p.getByLabel('Mensagem para o assistente');
  await box.fill('gastei 42 no almoço');
  await box.press('Enter');
  await p.getByText(/Pronto, tirei da sua cabeça/).waitFor({ timeout: 15000 });
  await p.goto(base + '/dinheiro/extrato', { waitUntil: 'networkidle' });
  ok(await p.getByText('−R$ 42,00').first().isVisible(), 'gasto da conversa chega no extrato');

  await p.goto(base + '/ajustes', { waitUntil: 'networkidle' });
  ok(await p.getByText(email).isVisible(), 'ajustes mostra o e-mail da conta');
  await p.getByRole('button', { name: 'Sair', exact: true }).click();
  await p.waitForURL('**/entrar');
  await p.goto(base + '/conversa');
  ok(p.url().includes('/entrar'), 'sair encerra a sessão');

  await p.getByRole('button', { name: 'Esqueci a senha' }).click();
  await p.getByLabel('E-mail').fill(email);
  await p.getByRole('button', { name: 'Mandar o link' }).click();
  await p.getByText('Se existir uma conta com').waitFor();
  const reset = await lastLinkTo(email, /recovery|verify/);
  await p.goto(reset);
  await p.waitForURL('**/entrar/nova-senha');
  await p.getByLabel('Senha nova').fill('outra-senha-boa-456');
  await p.getByRole('button', { name: 'Salvar a senha' }).click();
  await p.waitForURL('**/conversa');
  ok(true, 'esqueci a senha: link, senha nova e entra');

  ok(errors.length === 0, 'sem erros na página' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FALHOU ' + e.message.split('\n')[0]); process.exitCode = 1; });
