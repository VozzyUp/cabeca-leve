// Verificação das telas do M3 e M4 no navegador. Rodar com o servidor de pé e os dados
// recém-zerados: npm run reset:data && npm run dev, depois
// node scripts/m3-check.cjs replica/clone-screens [grupo]
const { chromium } = require('playwright');
const out = process.argv[2];
const only = process.argv[3];
const base = 'http://localhost:3000';
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU') + ' ' + m); if (!c) process.exitCode = 1; };

// cada grupo: telas (id, caminho) e as verificações de cada uma
const groups = {
  financas: [
    ['S19', '/dinheiro/variaveis', async (p) => {
      ok(await p.getByText('No ritmo atual').isVisible(), 'S19: projeção do mês');
      ok(await p.getByRole('table', { name: /por categoria/ }).isVisible(), 'S19: tabela por categoria');
      await p.getByText('Ver como tabela').first().click();
      ok(await p.getByRole('table', { name: /por dia/ }).isVisible(), 'S19: gráfico também como tabela');
    }],
    ['S20', '/dinheiro/fixos', async (p) => {
      ok(await p.getByText('Aluguel').isVisible(), 'S20: fixos listados');
      const sw = p.getByRole('switch', { name: 'Internet ativo' });
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), sw.click()]);
      await p.reload({ waitUntil: 'networkidle' });
      ok(await p.getByRole('switch', { name: 'Internet ativo' }).getAttribute('aria-checked') === 'false', 'S20: pausar fica salvo');
      ok((await p.getByText('Sai todo mês').locator('..').innerText()).includes('1.938,90'), 'S20: total sem o fixo pausado (1.800 + 99 + 39,90)');
    }],
    ['S21', '/dinheiro/parcelas', async (p) => {
      ok(await p.getByText('Notebook').isVisible() && await p.getByText(/Parcela 4 de 10/).isVisible(), 'S21: notebook na parcela 4 de 10');
    }],
    ['S22', '/dinheiro/contas', async (p) => {
      ok(await p.getByText('Fatura aberta').first().isVisible(), 'S22: fatura do cartão');
      ok(await p.getByRole('progressbar').count() === 1, 'S22: limite usado');
    }],
    ['S23', '/dinheiro/analise', async (p) => {
      ok(await p.getByText('Entrada média').isVisible(), 'S23: médias');
      ok(await p.getByRole('table', { name: /mês passado comparado/ }).isVisible(), 'S23: tabela de categorias');
    }],
  ],
};

(async () => {
  const b = await chromium.launch();
  for (const [name, screens] of Object.entries(groups)) {
    if (only && only !== name) continue;
    for (const [vw, suffix] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
      const ctx = await b.newContext({ viewport: vw, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
      const p = await ctx.newPage();
      const errors = [];
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('pageerror', (e) => errors.push(e.message));
      for (const [id, path, check] of screens) {
        await p.goto(base + path, { waitUntil: 'networkidle' });
        if (suffix === 'desktop') await check(p);
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        ok(!overflow, `${id} ${suffix}: sem rolagem horizontal`);
        await p.screenshot({ path: `${out}/${id}-${suffix}.png`, fullPage: suffix === 'desktop' });
      }
      ok(errors.length === 0, `${name} ${suffix}: sem erros no console${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
      await ctx.close();
    }
  }
  await b.close();
})();
