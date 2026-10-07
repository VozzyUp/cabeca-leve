// Verificação das telas do M2 (S05, S09, S12, S18) no navegador. Rodar com o servidor
// recém-iniciado: npm run dev, depois node scripts/m2-check.cjs replica/clone-screens
const { chromium } = require('playwright');
const out = process.argv[2];
const base = 'http://localhost:3000';
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  // clica e espera o servidor confirmar (em dev, a 1ª chamada de uma rota compila e demora)
  const clickAndSave = async (locator, pattern) => {
    await Promise.all([p.waitForResponse((r) => pattern.test(r.url()) && r.request().method() !== 'GET'), locator.click()]);
  };
  const go = (path) => p.goto(base + path, { waitUntil: 'networkidle' });

  // S09 tarefas
  await go('/tarefas');
  ok(await p.getByText('Enviar o orçamento para o cliente').isVisible(), 'S09: tarefas de hoje aparecem');
  await p.getByRole('button', { name: 'Adicionar' }).click();
  ok(await p.getByText('Escreva o que precisa ser feito.').isVisible(), 'S09: título vazio mostra erro no campo');
  await p.getByLabel('Nova tarefa').fill('Comprar presente de aniversário da minha avó que faz noventa anos');
  await p.getByLabel('Prazo').fill(await p.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())));
  await p.getByRole('button', { name: 'Adicionar' }).click();
  await p.getByText('Comprar presente de aniversário', { exact: false }).waitFor();
  ok(true, 'S09: tarefa com título longo criada pelo formulário e listada em Hoje');
  await clickAndSave(p.getByRole('checkbox', { name: /Enviar o orçamento/ }), /\/api\/tasks\//);
  await p.getByRole('radio', { name: /Feitas/ }).click();
  ok(await p.getByText('Enviar o orçamento para o cliente').isVisible(), 'S09: tarefa concluída vai para Feitas');
  const saved = await p.evaluate(async () => (await (await fetch('/api/tasks')).json()).tasks.find((t) => t.title.startsWith('Enviar o orçamento')).status);
  ok(saved === 'done', `S09: a conclusão ficou salva no servidor (${saved})`);
  await p.getByRole('radio', { name: /Atrasadas/ }).click();
  ok(await p.getByText('Responder o e-mail da escola').isVisible(), 'S09: atrasadas listadas');
  await p.getByRole('radio', { name: /Hoje/ }).click();
  await p.screenshot({ path: `${out}/S09-desktop.png` });

  // conversa cria tarefa e hábito
  await go('/conversa');
  const box = p.getByLabel('Mensagem para o assistente');
  await box.fill('cria uma tarefa de ligar pro banco amanhã e quero ler todo dia às 21h');
  await box.press('Enter');
  await p.getByText('Feito: salvei').waitFor({ timeout: 10000 });
  ok(await p.getByText('Tarefa salvo').count() + await p.getByText('Tarefa salva').count() >= 1 && await p.getByText('Hábito salvo').isVisible(), 'S02: cards de tarefa e hábito pela conversa');

  // S12 hábitos
  await go('/habitos');
  ok(await p.getByRole('heading', { name: 'Ler', exact: true }).isVisible(), 'S12: hábito criado pela conversa aparece');
  const med = p.locator('li', { has: p.getByRole('heading', { name: 'Meditar 10 minutos', exact: true }) });
  await clickAndSave(med.getByRole('button', { name: 'Marcar hoje' }), /\/api\/habits\//);
  await med.getByRole('button', { name: 'Feito' }).waitFor();
  ok(true, 'S12: marcar hoje vira "Feito"');
  ok(/Sequência\s*4/.test(await med.innerText()), 'S12: sequência conta hoje (3 dias seguidos + hoje = 4)');
  await p.screenshot({ path: `${out}/S12-desktop.png` });

  // S18 dinheiro
  await go('/dinheiro');
  ok(await p.getByText('Sobra do mês').isVisible(), 'S18: resumo do mês');
  const rows = await p.locator('table tbody tr').count();
  ok(rows >= 4, `S18: gastos por categoria (${rows} linhas)`);
  await p.screenshot({ path: `${out}/S18-desktop.png` });
  // os exemplos têm 6 meses de histórico: o 7º mês para trás está vazio
  for (let i = 0; i < 6; i++) { await p.getByRole('button', { name: 'Mês anterior' }).click(); await p.waitForLoadState('networkidle'); }
  await p.getByText('Nenhum gasto neste mês').waitFor({ timeout: 5000 });
  ok(true, 'S18: mês sem lançamentos mostra estado vazio');
  ok(await p.getByRole('button', { name: 'Próximo mês' }).isEnabled(), 'S18: dá para voltar ao mês atual');

  // S05 meu dia
  await go('/dia');
  const before = await p.getByText(/\d+ de \d+/).first().innerText();
  await clickAndSave(p.getByRole('checkbox', { name: /Tarefa: Marcar consulta/ }), /\/api\/tasks\//);
  const after = await p.getByText(/\d+ de \d+/).first().innerText();
  ok(before !== after, `S05: marcar tarefa no dia atualiza o placar (${before} -> ${after})`);
  ok(/^[A-ZÀ-Ú][a-zà-ú-]+, \d+ de [a-zç]+$/.test(await p.locator('header p.text-sm').innerText()), 'S05: data com maiúscula só no início');
  await p.screenshot({ path: `${out}/S05-desktop.png` });

  // celular
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  m.on('pageerror', (e) => errors.push(e.message));
  for (const [id, path] of [['S05', '/dia'], ['S09', '/tarefas'], ['S12', '/habitos'], ['S18', '/dinheiro']]) {
    await m.goto(base + path, { waitUntil: 'networkidle' });
    const over = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    ok(!over, `${id} no celular (390px): sem rolagem horizontal`);
    await m.screenshot({ path: `${out}/${id}-mobile.png`, fullPage: true });
  }
  ok(errors.length === 0, 'sem erros no console' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
