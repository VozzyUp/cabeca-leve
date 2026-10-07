# Assistente pessoal com IA

Nome provisório. O nome e a identidade definitivos saem do `/replica-brand`.

Assistente pessoal por conversa (texto, áudio e foto), na web e no WhatsApp, que
organiza tarefas, lembretes, finanças, hábitos, notas e metas.

## Planejamento

O planejamento segue o pacote de skills Replica, na pasta `replica/`:

| arquivo | conteúdo |
| --- | --- |
| `replica/recon.md` | mapa do app de referência: fontes, telas, fluxos, componentes, modelo de dados, tamanho |
| `replica/features.csv` | matriz de funcionalidades (must / should / could / skip) |
| `replica/screens/` | capturas públicas da App Store do app de referência. Só para consulta, nunca entram no produto |
| `replica/architecture.md` | stack, como o assistente funciona, API, partes difíceis e ordem de construção |
| `replica/schema.sql` | esquema do banco (Postgres/Supabase): 53 tabelas, 2 views, RLS |
| `replica/schema-test.mjs` | testes do esquema num Postgres local (PGlite) |
| `replica/design/` | tokens (`tokens.json`), especificação dos componentes e capturas da vitrine `/design` |

Ordem das etapas: recon → architect → design → build → backend → test → diff →
entrepreneur → brand → launch → deploy.

## Rodar o app

```bash
npm install
npm run dev        # http://localhost:3000/design mostra o sistema visual
npm run tokens     # regera app/tokens.css depois de mudar replica/design/tokens.json
npm run reset:data # volta o banco provisório (.data/fake-db.json) aos dados de exemplo
npm test           # testes de unidade (Vitest)
```

Verificação das telas no navegador (com o `npm run dev` de pé e os dados zerados):

```bash
node scripts/slice-check.cjs replica/clone-screens        # M1: conversa, lembretes, extrato
node scripts/m2-check.cjs replica/clone-screens           # M2: tarefas, hábitos, dinheiro, meu dia
node scripts/m3-check.cjs replica/clone-screens financas  # ou organizacao, plano, saude, conta, exclusao
```

Até o `/replica-backend`, os dados são de exemplo e ficam num arquivo local; login, pagamento,
WhatsApp e agendas mostram a tela completa, mas ainda não conectam a nada.
