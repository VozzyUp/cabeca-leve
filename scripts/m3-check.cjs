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
  plano: [
    ['S05', '/dia', async (p) => {
      ok(await p.getByText('Reunião de alinhamento').isVisible(), 'S05: compromisso da agenda no dia');
    }],
    ['S04', '/briefing', async (p) => {
      ok(await p.getByText(/^(Bom dia|Boa tarde|Boa noite), Fernanda\.$/).isVisible(), 'S04: saudação com o nome');
      ok(await p.getByText(/^Hoje você tem .*compromisso/).isVisible(), 'S04: frase de resumo');
      ok(await p.getByRole('button', { name: 'Ouvir' }).isVisible(), 'S04: ouvir em voz alta');
    }],
    ['S06', '/dia/calendario', async (p) => {
      const sel = () => p.locator('[role=gridcell][aria-selected=true] button');
      const before = await sel().getAttribute('data-day');
      await sel().focus();
      await p.keyboard.press('ArrowRight');
      const after = await sel().getAttribute('data-day');
      ok(before !== after && await p.evaluate(() => document.activeElement?.getAttribute('data-day')) === after, `S06: seta → move o dia e o foco (${before} -> ${after})`);
      await p.keyboard.press('ArrowLeft');
      ok(await p.getByRole('link', { name: /Reunião de alinhamento/ }).isVisible(), 'S06: itens do dia escolhido');
      await p.getByRole('button', { name: 'Agenda' }).click();
      ok(!(await p.getByRole('link', { name: /Reunião de alinhamento/ }).isVisible()), 'S06: filtro por fonte esconde a agenda');
      await p.getByRole('button', { name: 'Agenda' }).click();
      await p.getByRole('radio', { name: 'Semana' }).click();
      ok(await p.locator('[role=gridcell]').count() === 7, 'S06: visão de semana');
      await p.getByRole('radio', { name: 'Mês' }).click();
    }],
    ['S08', '/agenda', async (p) => {
      ok(!(await p.getByText('Entrega do relatório').isVisible()), 'S08: Outlook desligado não mostra os eventos dele');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('switch', { name: 'Outlook conectada' }).click()]);
      await p.getByText('Entrega do relatório').waitFor();
      ok(true, 'S08: conectar o Outlook mostra os eventos dele');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('switch', { name: 'Outlook conectada' }).click()]);
    }],
    ['S07', '/foco', async (p) => {
      await p.getByRole('button', { name: 'Começar' }).click();
      ok(await p.getByText('Diga no que você vai focar.').isVisible(), 'S07: sem título mostra erro');
      await p.getByLabel('No que você vai focar?').fill('Revisar a proposta');
      await p.getByRole('radio', { name: '15 min' }).click();
      await p.getByRole('button', { name: 'Começar' }).click();
      await p.waitForTimeout(1300);
      ok(/14:5\d/.test(await p.locator('p.font-mono').innerText()), 'S07: contagem regressiva');
      await p.getByRole('button', { name: 'Pausar' }).click();
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Terminar' }).click()]);
      await p.getByText('Sessão concluída.').waitFor();
      ok(true, 'S07: terminar antes salva a sessão');
      ok(await p.locator('li', { hasText: 'Revisar a proposta' }).isVisible(), 'S07: sessão no histórico');
      await p.getByRole('button', { name: 'Nova sessão' }).click();
    }],
  ],
  saude: [
    ['S13', async (p) => {
      await p.goto(base + '/habitos', { waitUntil: 'networkidle' });
      return p.getByRole('link', { name: 'Meditar 10 minutos' }).getAttribute('href');
    }, async (p) => {
      ok(await p.getByRole('heading', { name: 'Meditar 10 minutos' }).isVisible(), 'S13: detalhe aberto pelo nome na lista de hábitos');
      const day = await p.evaluate(() => { const d = new Date(Date.now() - 4 * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d); });
      const label = await p.evaluate((d) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00Z')), day);
      const cell = p.getByRole('button', { name: new RegExp('^' + label + ': ') });
      ok(await cell.getAttribute('aria-pressed') === 'false', 'S13: o dia sem registro (há 4 dias) aparece em aberto');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), cell.click()]);
      await p.reload({ waitUntil: 'networkidle' });
      ok(await p.getByRole('button', { name: new RegExp('^' + label + ': ') }).getAttribute('aria-pressed') === 'true', 'S13: marcar um dia anterior fica salvo');
      ok(await p.getByText(/Você vai melhor às/).isVisible(), 'S13: melhores dias da semana');
    }],
    ['S14', '/saude', async (p) => {
      ok(await p.getByText('Calorias de hoje').isVisible() && await p.getByText('Refeições de hoje').isVisible(), 'S14: resumo do dia');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('checkbox', { name: /Almoço/ }).click()]);
      await p.reload({ waitUntil: 'networkidle' });
      ok(await p.getByRole('checkbox', { name: /Almoço/ }).isChecked(), 'S14: refeição marcada fica salva');
    }],
    ['S15', '/saude/treino', async (p) => {
      ok(await p.getByRole('table', { name: /Treino A/ }).isVisible(), 'S15: ficha com exercícios');
      ok(await p.getByRole('img', { name: 'no recorde' }).count() >= 1, 'S15: recorde marcado');
    }],
    ['S16', '/saude/dieta', async (p) => {
      ok(await p.getByRole('progressbar', { name: 'Calorias de hoje' }).isVisible(), 'S16: calorias do dia');
      ok(await p.getByRole('table', { name: /últimos 7 dias/ }).isVisible(), 'S16: adesão da semana');
    }],
    ['S17', '/saude/progresso', async (p) => {
      await p.getByRole('button', { name: 'Salvar medida de hoje' }).click();
      ok(await p.getByText('Preencha pelo menos uma medida.').isVisible(), 'S17: formulário vazio mostra erro');
      await p.getByLabel('Peso (kg)').fill('80,4');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Salvar medida de hoje' }).click()]);
      await p.getByText('Medida de hoje salva.').waitFor();
      await p.locator('p.text-metric', { hasText: '80,4' }).first().waitFor({ timeout: 5000 }).catch(() => {});
      ok((await p.locator('p.text-metric').first().innerText()).includes('80,4'), 'S17: peso novo vira o atual');
      await p.getByText('Ver como tabela').click();
      ok(await p.getByRole('table', { name: 'Peso ao longo do tempo' }).isVisible(), 'S17: gráfico também como tabela');
    }],
  ],
  conta: [
    ['S29', '/ajustes', async (p) => {
      await p.getByLabel('Como o assistente chama você').fill('Fê');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Salvar', exact: true }).click()]);
      await p.getByText('Salvo', { exact: true }).waitFor();
      await p.getByLabel('WhatsApp').fill('123');
      await p.getByRole('button', { name: 'Vincular' }).click();
      ok(await p.getByText('Use o número com DDD').isVisible(), 'S29: número inválido mostra erro');
      await p.getByLabel('WhatsApp').fill('(11) 98765-4321');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Vincular' }).click()]);
      await p.reload({ waitUntil: 'networkidle' });
      ok(await p.getByText('Vinculado: +5511987654321').isVisible(), 'S29: WhatsApp vinculado fica salvo em E.164');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Baixar' }).click()]);
      const json = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
      ok(json.settings.name === 'Fê' && json.transactions.length > 100, 'S29: baixar meus dados traz tudo em JSON');
      ok(await p.getByRole('button', { name: 'Excluir tudo' }).isDisabled(), 'S29: excluir só libera depois de digitar EXCLUIR');
    }],
    ['S30', '/ajustes/assistente', async (p) => {
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('radio', { name: 'Direto' }).click()]);
      ok(await p.getByText('Feito: lembrete para amanhã às 9h.', { exact: false }).isVisible(), 'S30: exemplo muda com o tom');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('radio', { name: 'Claro' }).click()]);
      await p.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      ok(true, `S30: tema claro aplicado (fundo ${bg})`);
      await p.waitForTimeout(400);  // espera a transição de cores terminar
      await p.screenshot({ path: `${out}/S30-light.png` });
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('radio', { name: 'Escuro' }).click()]);
      await p.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    }],
    ['S31', '/entrar', async (p) => {
      await p.getByRole('button', { name: 'Entrar', exact: true }).last().click();
      ok(await p.getByText('Confira o e-mail').isVisible() && await p.getByText('pelo menos 8 caracteres').isVisible(), 'S31: erros nos campos');
      await p.getByRole('button', { name: 'Esqueci a senha' }).click();
      await p.getByLabel('E-mail').fill('ana@exemplo.com.br');
      await p.getByRole('button', { name: 'Mandar o link' }).click();
      await p.getByText('Se existir uma conta com').waitFor();
      ok(true, 'S31: recuperar senha sem revelar se a conta existe');
      await p.getByRole('button', { name: 'Voltar para entrar' }).click();
      await p.getByLabel('Senha').fill('12345678');
      await p.getByRole('button', { name: 'Entrar', exact: true }).last().click();
      await p.waitForURL('**/conversa');
      ok(true, 'S31: entrar leva à conversa');
      await p.goto(base + '/entrar', { waitUntil: 'networkidle' });
    }],
    ['S32', '/planos', async (p) => {
      ok(await p.getByText('R$ 39,90').isVisible() && await p.getByText('R$ 359,00').isVisible(), 'S32: preços mensal e anual');
      ok(await p.getByText(/economize 25%/).isVisible(), 'S32: economia do anual');
      await p.getByRole('link', { name: /Começar/ }).last().click();
      await p.waitForURL('**/entrar?modo=criar&plano=yearly');
      ok(await p.getByRole('heading', { name: 'Criar conta' }).isVisible(), 'S32: assinar leva ao cadastro');
      await p.goto(base + '/planos', { waitUntil: 'networkidle' });
    }],
    ['S03', '/conversa/voz', async (p) => {
      await p.getByRole('button', { name: 'Falar com o assistente' }).click();
      await p.getByText(/Pronto, tirei da sua cabeça/).waitFor({ timeout: 10000 });
      ok(await p.getByText('gastei 20 no café').isVisible(), 'S03: fala transcrita aparece');
      await p.getByText('Toque para falar').waitFor({ timeout: 3000 });
      ok(true, 'S03: resposta lida e volta a esperar');
      const tx = await p.evaluate(async () => (await (await fetch('/api/transactions')).json()).transactions.some((t) => t.amountCents === 2000));
      ok(tx, 'S03: o gasto falado foi salvo');
    }],
  ],
  exclusao: [
    ['S29', '/ajustes', async (p) => {
      await p.getByLabel('Digite "EXCLUIR" para confirmar').fill('excluir');
      await Promise.all([p.waitForResponse((r) => r.request().method() === 'POST'), p.getByRole('button', { name: 'Excluir tudo' }).click()]);
      await p.waitForURL('**/entrar?conta=excluida');
      ok(await p.getByText('Sua conta e todos os dados foram excluídos.').isVisible(), 'S29: excluir a conta apaga e leva ao login');
      for (const [path, text] of [['/tarefas', 'Nada para hoje'], ['/dinheiro/fixos', 'Nenhum fixo cadastrado'], ['/notas', 'Nenhuma nota aqui'], ['/metas', 'Nenhuma meta']]) {
        await p.goto(base + path, { waitUntil: 'networkidle' });
        ok(await p.getByText(text, { exact: false }).first().isVisible(), `depois de excluir, ${path} mostra o estado vazio`);
      }
      await p.goto(base + '/ajustes', { waitUntil: 'networkidle' });
    }],
  ],
};

(async () => {
  const b = await chromium.launch();
  for (const [name, screens] of Object.entries(groups)) {
    if (only && only !== name) continue;
    for (const [vw, suffix] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
      const ctx = await b.newContext({ viewport: vw, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
      // voz simulada: o Chromium de teste não tem microfone
      await ctx.addInitScript(() => {
        window.SpeechRecognition = window.webkitSpeechRecognition = class {
          start() { setTimeout(() => { this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'gastei 20 no café' } }] }); this.onend?.(); }, 200); }
          stop() { this.onend?.(); } abort() {}
        };
        speechSynthesis.speak = (u) => setTimeout(() => u.onend?.(), 200);
      });
      const p = await ctx.newPage();
      const errors = [];
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('pageerror', (e) => errors.push(e.message));
      for (const [id, path, check] of screens) {
        // o caminho pode depender dos dados (ex.: id do hábito)
        const url = typeof path === 'function' ? await path(p) : path;
        await p.goto(base + url, { waitUntil: 'networkidle' });
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
