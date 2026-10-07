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
  organizacao: [
    ['S10', '/projetos', async (p) => {
      ok(await p.getByRole('heading', { name: 'Mudança de apartamento' }).isVisible(), 'S10: projeto em andamento');
      ok(await p.getByRole('progressbar', { name: '2 de 5 etapas' }).first().isVisible(), 'S10: progresso pelas etapas');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('checkbox', { name: 'Contratar a mudança' }).click()]);
      await p.reload({ waitUntil: 'networkidle' });
      ok(await p.getByRole('progressbar', { name: '3 de 5 etapas' }).count() === 2, 'S10: etapa marcada fica salva e o progresso sobe');
    }],
    ['S25', '/metas', async (p) => {
      ok(await p.getByRole('heading', { name: 'Reserva de emergência' }).isVisible(), 'S25: metas listadas');
      const card = p.locator('li', { has: p.getByRole('heading', { name: 'Ler 12 livros no ano' }) });
      await card.getByRole('button', { name: 'Registrar' }).click();
      ok(await card.getByText('Digite um número inteiro.').isVisible(), 'S25: valor vazio mostra erro');
      await card.getByLabel('Quantidade para Ler 12 livros no ano').fill('1');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), card.getByRole('button', { name: 'Registrar' }).click()]);
      await card.getByText('9de 12').or(card.getByText(/^9\s*de 12$/)).first().waitFor({ timeout: 5000 }).catch(() => {});
      ok((await card.innerText()).includes('9 de 12'), 'S25: registrar avanço atualiza a meta');
    }],
    ['S26', '/notas', async (p) => {
      ok(await p.getByText('Ideias para o aniversário').isVisible(), 'S26: notas listadas, fixada primeiro');
      await p.getByRole('button', { name: 'Trabalho' }).click();
      ok(await p.getByText('Reunião de segunda').isVisible() && !(await p.getByText('Livros recomendados').isVisible()), 'S26: filtro por caderno');
      await p.getByLabel('Título').fill('Pauta da reunião');
      await p.getByLabel('Texto').fill('Levar os números de setembro.');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Salvar' }).click()]);
      await p.getByRole('heading', { name: 'Pauta da reunião' }).waitFor();
      ok(true, 'S26: nota criada no caderno filtrado');
      await p.getByRole('radio', { name: 'Diário' }).click();
      ok(await p.getByText('Dia produtivo', { exact: false }).isVisible(), 'S26: diário');
      await p.getByRole('radio', { name: 'Notas' }).click();
    }],
    ['S27', '/automacoes', async (p) => {
      ok(await p.getByText('Dias úteis às 07:00 · por WhatsApp').isVisible(), 'S27: agenda da revisão em texto');
      ok(await p.getByRole('switch', { name: 'Fechamento do mês ativa' }).getAttribute('aria-checked') === 'false', 'S27: revisão pausada');
    }],
    ['S28', '/avisos', async (p) => {
      ok(await p.getByText('Novos (2)').isVisible(), 'S28: dois avisos novos');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Marcar todos como lidos' }).click()]);
      await p.getByText('Tudo lido.').waitFor();
      ok(true, 'S28: marcar todos como lidos');
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
        // uma verificação que quebra conta como falha e não interrompe as outras telas
        if (suffix === 'desktop') await check(p).catch((e) => ok(false, `${id}: ${e.message.split('\n')[0]}`));
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
