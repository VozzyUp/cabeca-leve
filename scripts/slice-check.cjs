// Verificação da fatia vertical (M1) no navegador. Rodar com o servidor recém-iniciado
// (os dados ficam em memória): npm run dev, depois node scripts/slice-check.cjs replica/clone-screens
// Fatia vertical de ponta a ponta (M1) + capturas para o /replica-diff
const { chromium } = require('playwright');
const out = process.argv[2];
const base = 'http://localhost:3000';
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.grantPermissions(['notifications'], { origin: base });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));

  await p.goto(base + '/conversa', { waitUntil: 'networkidle' });
  ok(await p.getByText('O que você quer tirar da cabeça?').isVisible(), 'S01: início da conversa vazio com exemplos');
  await p.screenshot({ path: `${out}/S01-desktop.png` });

  const box = p.getByLabel('Mensagem para o assistente');
  await box.fill('gastei 35 na padaria e me lembra do mercado às 18h');
  await box.press('Enter');
  await p.getByText(/Pronto, tirei da sua cabeça/).waitFor({ timeout: 10000 });
  const cards = p.locator('article');
  ok(await cards.count() === 2, 'S02: dois cards (lançamento + lembrete)');
  ok(await p.getByText('Padaria', { exact: true }).isVisible() && await p.getByText('Mercado', { exact: true }).isVisible(), 'S02: títulos certos nos cards');
  await p.screenshot({ path: `${out}/S02-desktop.png` });

  // desfazer o lembrete
  await cards.nth(1).getByRole('button', { name: 'Desfazer' }).click();
  await p.getByText('Lembrete desfeito').waitFor({ timeout: 5000 });
  ok(true, 'S02: desfazer marca o card como desfeito');

  await p.goto(base + '/lembretes', { waitUntil: 'networkidle' });
  ok(await p.getByText('Mercado').count() === 0, 'S11: lembrete desfeito não aparece');
  await p.screenshot({ path: `${out}/S11-desktop.png` });

  await p.goto(base + '/dinheiro/extrato', { waitUntil: 'networkidle' });
  ok(await p.getByText('Padaria').isVisible(), 'S24: gasto do chat aparece no extrato');
  await p.getByLabel('Buscar no extrato').fill('aliment');
  ok(await p.getByText('Padaria').isVisible() && await p.getByText('Compra do mês').count() === 0, 'S24: busca por categoria filtra');
  await p.getByLabel('Buscar no extrato').fill('');
  await p.screenshot({ path: `${out}/S24-desktop.png` });

  // lembrete para o próximo minuto, pelo chat; o vigia avisa sem recarregar
  const t = new Date(Date.now() + 60_000);
  const hh = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
  await p.goto(base + '/conversa', { waitUntil: 'networkidle' });
  await box.fill(`me lembra de beber água às ${hh}`);
  await box.press('Enter');
  await p.getByText('Beber água', { exact: true }).waitFor({ timeout: 10000 });
  await p.getByText('Lembrete: Beber água').waitFor({ timeout: 130000 });
  ok(true, `S35 (parcial): aviso de "Beber água" apareceu às ${hh} com o app aberto`);

  // celular
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  m.on('pageerror', (e) => errors.push(e.message));
  for (const [id, path] of [['S02', '/conversa'], ['S11', '/lembretes'], ['S24', '/dinheiro/extrato']]) {
    await m.goto(base + path, { waitUntil: 'networkidle' });
    await m.screenshot({ path: `${out}/${id}-mobile.png` });
  }
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, 'celular (390px): sem rolagem horizontal');

  ok(errors.length === 0, 'sem erros no console' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
