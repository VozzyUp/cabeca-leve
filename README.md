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
```
