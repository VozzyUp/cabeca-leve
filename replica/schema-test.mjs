// Teste do esquema (replica/schema.sql) num Postgres local, sem Supabase.
// Rodar: npm i -D @electric-sql/pglite@0.3 && node replica/schema-test.mjs replica/schema.sql
// Testa replica/schema.sql num Postgres local (PGlite), com stubs do Supabase.
// Uso: node test-schema.mjs <caminho/schema.sql>
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import fs from 'node:fs';

const schema = fs.readFileSync(process.argv[2], 'utf8');
const db = await PGlite.create({ extensions: { vector, unaccent } });

const results = [];
const ok = (name) => results.push(['ok', name]);
const fail = (name, why) => results.push(['FALHOU', name, why]);
async function expectOk(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e.message); }
}
async function expectError(name, fn, match) {
  try { await fn(); fail(name, 'esperava erro, mas passou'); }
  catch (e) { if (!match || new RegExp(match, 'i').test(e.message)) ok(name); else fail(name, e.message); }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// --- stubs do Supabase
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  grant usage on schema public, auth to authenticated;
`);

await expectOk('esquema aplica sem erro', () => db.exec(schema));
await db.exec(`grant select on all tables in schema public to authenticated;
               grant execute on function auth.uid() to authenticated;`);

const t = await one(`select count(*)::int n from information_schema.tables
                     where table_schema = 'public' and table_type = 'BASE TABLE'`);
const v = await one(`select count(*)::int n from information_schema.views where table_schema = 'public'`);
const noRls = await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                              where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
noRls.rows.length ? fail('RLS ligado em todas as tabelas', noRls.rows.map(r => r.relname).join(', '))
                  : ok('RLS ligado em todas as tabelas');

// --- cadastro cria perfil, categorias e regras
const A = (await one(`insert into auth.users (email) values ('a@x.com') returning id`)).id;
const B = (await one(`insert into auth.users (email) values ('b@x.com') returning id`)).id;
const counts = await one(`select (select count(*) from profiles)::int p, (select count(*) from categories)::int c,
                                 (select count(*) from alert_rules)::int r`);
counts.p === 2 && counts.c === 28 && counts.r === 16 ? ok('cadastro cria perfil, 14 categorias e 8 regras por usuário')
  : fail('cadastro cria perfil, categorias e regras', JSON.stringify(counts));

// --- isolamento entre usuários (FK composta)
const projA = (await one(`insert into projects (user_id, name) values ($1, 'Reforma') returning id`, [A])).id;
await expectError('tarefa de B não pode apontar para projeto de A',
  () => db.query(`insert into tasks (user_id, title, project_id) values ($1, 'x', $2)`, [B, projA]), 'foreign key');
await expectOk('tarefa de A no projeto de A',
  () => db.query(`insert into tasks (user_id, title, project_id) values ($1, 'Comprar piso', $2)`, [A, projA]));

// --- hábito: um registro por dia
const habit = (await one(`insert into habits (user_id, name) values ($1, 'Meditar') returning id`, [A])).id;
await db.query(`insert into habit_logs (user_id, habit_id, day) values ($1, $2, '2026-10-06')`, [A, habit]);
await expectError('dois registros do mesmo hábito no mesmo dia',
  () => db.query(`insert into habit_logs (user_id, habit_id, day) values ($1, $2, '2026-10-06')`, [A, habit]), 'unique');

// --- mensagens somente-anexar
const conv = (await one(`insert into conversations (user_id, local_date) values ($1, '2026-10-06') returning id`, [A])).id;
const msg = (await one(`insert into messages (user_id, conversation_id, seq, role, channel, content, client_message_id)
  values ($1, $2, 0, 'user', 'web', '[{"type":"text","text":"oi"}]', 'c1') returning id`, [A, conv])).id;
await expectError('editar o conteúdo de uma mensagem é proibido',
  () => db.query(`update messages set content = '[]' where id = $1`, [msg]), 'somente-anexar');
await expectOk('atualizar o resumo da mensagem é permitido',
  () => db.query(`update messages set text_preview = 'oi' where id = $1`, [msg]));
await expectError('mesmo client_message_id não duplica (duplo clique)',
  () => db.query(`insert into messages (user_id, conversation_id, seq, role, channel, content, client_message_id)
    values ($1, $2, 1, 'user', 'web', '[]', 'c1')`, [A, conv]), 'unique');

// --- finanças
const acc1 = (await one(`insert into accounts (user_id, name, opening_balance_cents, opening_balance_on)
  values ($1, 'Banco', 100000, '2026-10-01') returning id`, [A])).id;
const acc2 = (await one(`insert into accounts (user_id, name, opening_balance_on)
  values ($1, 'Reserva', '2026-10-01') returning id`, [A])).id;
const card = (await one(`insert into cards (user_id, name, limit_cents, closing_day, due_day, payment_account_id)
  values ($1, 'Cartão', 500000, 3, 10, $2) returning id`, [A, acc1])).id;
await db.query(`insert into transactions (user_id, type, amount_cents, occurred_on, description, account_id)
  values ($1, 'income', 50000, '2026-10-02', 'Salário', $2),
         ($1, 'expense', 20000, '2026-10-03', 'Mercado', $2),
         ($1, 'expense', 9999, '2026-10-04', 'Previsto', $2)`, [A, acc1]);
await db.query(`update transactions set status = 'planned' where description = 'Previsto'`);
await db.query(`insert into transactions (user_id, type, amount_cents, occurred_on, description, account_id, counterpart_account_id)
  values ($1, 'transfer', 10000, '2026-10-05', 'Guardar', $2, $3)`, [A, acc1, acc2]);
const bal = await db.query(`select account_id, balance_cents::bigint from account_balances where user_id = $1`, [A]);
const balMap = Object.fromEntries(bal.rows.map(r => [r.account_id, Number(r.balance_cents)]));
balMap[acc1] === 120000 && balMap[acc2] === 10000
  ? ok('saldo calculado: inicial + entradas - saídas ± transferências (ignora previstos)')
  : fail('saldo calculado', JSON.stringify(balMap));
await expectError('lançamento com conta e cartão ao mesmo tempo',
  () => db.query(`insert into transactions (user_id, type, amount_cents, occurred_on, description, account_id, card_id)
    values ($1, 'expense', 100, '2026-10-05', 'x', $2, $3)`, [A, acc1, card]), 'check');
await expectError('valor negativo fora de ajuste',
  () => db.query(`insert into transactions (user_id, type, amount_cents, occurred_on, description, account_id)
    values ($1, 'expense', -100, '2026-10-05', 'x', $2)`, [A, acc1]), 'check');
const inv = (await one(`insert into card_invoices (user_id, card_id, reference_month, closes_on, due_on)
  values ($1, $2, '2026-10-01', '2026-10-03', '2026-10-10') returning id`, [A, card])).id;
await db.query(`insert into transactions (user_id, type, amount_cents, occurred_on, description, card_id, invoice_id, payment_method)
  values ($1, 'expense', 3000, '2026-10-02', 'Uber', $2, $3, 'credit'),
         ($1, 'expense', 7000, '2026-10-02', 'Farmácia', $2, $3, 'credit')`, [A, card, inv]);
const tot = await one(`select total_cents::int from card_invoice_totals where invoice_id = $1`, [inv]);
tot.total_cents === 10000 ? ok('total da fatura = soma das compras no crédito') : fail('total da fatura', JSON.stringify(tot));
const bal2 = await one(`select balance_cents::bigint from account_balances where account_id = $1`, [acc1]);
Number(bal2.balance_cents) === 120000 ? ok('compra no crédito não mexe no saldo da conta') : fail('crédito x saldo', JSON.stringify(bal2));
const rec = (await one(`insert into recurrences (user_id, kind, description, amount_cents, frequency, anchor_on, account_id)
  values ($1, 'subscription', 'Streaming', 3990, 'monthly', '2026-10-15', $2) returning id`, [A, acc1])).id;
await db.query(`insert into transactions (user_id, type, status, amount_cents, occurred_on, description, account_id, recurrence_id, source)
  values ($1, 'expense', 'planned', 3990, '2026-10-15', 'Streaming', $2, $3, 'recurrence')`, [A, acc1, rec]);
await expectError('gerar a mesma ocorrência da recorrência duas vezes',
  () => db.query(`insert into transactions (user_id, type, status, amount_cents, occurred_on, description, account_id, recurrence_id, source)
    values ($1, 'expense', 'planned', 3990, '2026-10-15', 'Streaming', $2, $3, 'recurrence')`, [A, acc1, rec]), 'unique');
await expectError('conta com lançamentos não pode ser apagada (só arquivada)',
  () => db.query(`delete from accounts where id = $1`, [acc2]), 'foreign key');

// --- vínculo de WhatsApp
await db.query(`insert into channel_links (user_id, channel, external_id) values ($1, 'whatsapp', '+5511999990000'),
                                                                                 ($2, 'whatsapp', '+5511999990000')`, [A, B]);
ok('dois usuários podem tentar o mesmo número antes de verificar');
await db.query(`update channel_links set verified_at = now() where user_id = $1`, [A]);
await expectError('o mesmo número não pode ser verificado em duas contas',
  () => db.query(`update channel_links set verified_at = now() where user_id = $1`, [B]), 'unique');

// --- busca por sentido: apagar a nota apaga os vetores
const note = (await one(`insert into notes (user_id, title, content) values ($1, 'Reunião sobre a viagem', 'Lisboa e Porto em dezembro') returning id`, [A])).id;
const vec = '[' + Array(1024).fill(0.01).join(',') + ']';
await db.query(`insert into embeddings (user_id, source_type, source_id, content, embedding, model)
  values ($1, 'note', $2, 'Lisboa e Porto', $3, 'teste')`, [A, note, vec]);
const fts = await one(`select count(*)::int n from notes where search @@ plainto_tsquery('public.pt_unaccent', 'reuniao viagem dezembro')`);
fts.n === 1 ? ok('busca por texto ignora acento: "reuniao" acha "Reunião"') : fail('busca por texto sem acento', JSON.stringify(fts));
await db.query(`delete from notes where id = $1`, [note]);
const emb = await one(`select count(*)::int n from embeddings where source_id = $1`, [note]);
emb.n === 0 ? ok('apagar a nota apaga os vetores dela') : fail('vetores órfãos', JSON.stringify(emb));

// --- RLS: B só enxerga o que é dele
await db.query(`insert into tasks (user_id, title) values ($1, 'Tarefa de B')`, [B]);
await db.exec(`set role authenticated`);
await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [B]);
const seenTasks = await one(`select count(*)::int n, bool_and(user_id = auth.uid()) mine from tasks`);
const seenTx = await one(`select count(*)::int n from transactions`);
const seenSecrets = await one(`select count(*)::int n from integration_secrets`).catch(e => ({ err: e.message }));
await db.exec(`reset role`);
seenTasks.n === 1 && seenTasks.mine && seenTx.n === 0
  ? ok('RLS: usuário B vê só as próprias tarefas e nenhum lançamento de A')
  : fail('RLS de leitura', JSON.stringify({ seenTasks, seenTx }));
(seenSecrets.n === 0 || seenSecrets.err) ? ok('RLS: segredos de integração invisíveis para o navegador')
  : fail('RLS de segredos', JSON.stringify(seenSecrets));

// --- exclusão de conta (LGPD): tudo de A some, B intacto
await expectOk('apagar o usuário A apaga tudo dele em cascata', () => db.query(`delete from auth.users where id = $1`, [A]));
const leftovers = await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id'
  where n.nspname = 'public' and c.relkind = 'r'`);
let sobra = [];
for (const r of leftovers.rows) {
  const x = await one(`select count(*)::int n from public.${r.relname} where user_id = $1`, [A]);
  if (x.n) sobra.push(`${r.relname}=${x.n}`);
}
sobra.length ? fail('nada de A sobra no banco', sobra.join(', ')) : ok('nada de A sobra em nenhuma tabela');
const bLeft = await one(`select (select count(*) from tasks where user_id = $1)::int t, (select count(*) from categories where user_id = $1)::int c`, [B]);
bLeft.t === 1 && bLeft.c === 14 ? ok('dados de B continuam intactos') : fail('dados de B', JSON.stringify(bLeft));

console.log(`tabelas: ${t.n} | views: ${v.n}`);
for (const r of results) console.log(r[0].padEnd(6), r[1], r[2] ? '-> ' + r[2] : '');
const failed = results.filter(r => r[0] !== 'ok').length;
console.log(`\n${results.length - failed} ok, ${failed} falhas`);
process.exit(failed ? 1 : 0);
