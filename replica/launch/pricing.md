# Preço

Data: 2026-10-14. Preço muda: confira de novo antes de mudar o seu.

## 1. O mercado

| app | o que é | preço público | onde foi lido | data |
| --- | --- | --- | --- | --- |
| **o original** | assistente no WhatsApp e app (tarefas, dinheiro, hábitos) | plano único: R$ 49,90/mês ou R$ 399/ano; 14 dias de garantia; checkout externo | https://www.meu-nectar.com/#pricing (via `recon.md`). Hoje o site não mostra preço sem JavaScript e a App Store não lista compras no app | 2026-10-08 |
| Zapia | assistente de IA (app e WhatsApp) | Zapia AI Pro R$ 59,90; Zapia AI Ultra R$ 599,90 (a loja não diz o período de cada um) | https://apps.apple.com/br/app/id6470821480 (Compras dentro do app) | 2026-10-14 |
| Meu Assessor IA | assistente financeiro no WhatsApp | Plano Mensal R$ 149,90; Plano Anual R$ 299,90 | https://apps.apple.com/br/app/id6758778835 (Compras dentro do app) | 2026-10-14 |
| Tony (otony.ai) | assistente com voz | R$ 19,90, R$ 49,90 ou R$ 99,90 por mês; muda só o tempo de voz em tempo real | descrição do app na App Store (aparece na página do original) | 2026-10-14 |
| Myndit | só lembretes insistentes | R$ 9,90/mês ou R$ 79,90/ano | descrição do app na App Store (aparece na página do original) | 2026-10-14 |

A faixa de quem faz o pacote completo (tarefas + dinheiro + WhatsApp) vai de R$ 49,90 a R$ 149,90 por mês. Quem cobra menos faz uma coisa só.

## 2. O que os avaliadores do original disseram sobre preço e cobrança

Fonte: `feedback.md` e `fixes.md` (36 avaliações do original; a maioria dos temas é **fina**, de uma fonte só).

| tema | avaliações | o que resolve |
| --- | --- | --- |
| Cobrança depois de cancelar | 3 (+3 na categoria) | cancelar em um toque com comprovante e protocolo; cobrança que chega depois do cancelamento é estornada sozinha (F1, pronto) |
| Pagou e não entrou ("assinatura inválida") | 4 | acesso liberado enquanto a Asaas confirma, nunca "inválida" (F2, pronto) |
| Sem como testar antes de pagar | 2 | 7 dias grátis sem cartão (pronto) |
| "Caro" | 0 | ninguém reclamou do valor em si |

Leitura: o problema do original não é o preço, é **pagar e ficar sem resposta**. Não precisa ser o mais barato; precisa ser o mais confiável na hora de cobrar.

## 3. O que custa servir uma pessoa

Medido no seu banco (`ai_usage`), de 2026-10-09 a 2026-10-14. **Amostra pequena: 21 mensagens de 1 pessoa.** Refaça a conta com 2 a 4 semanas de uso real.

| modelo | custo medido por mensagem | 10 mensagens por dia (mês) | 20 mensagens por dia (mês) |
| --- | --- | --- | --- |
| Haiku 5.5 | US$ 0,0025 | US$ 0,75 (≈ R$ 4) | US$ 1,50 (≈ R$ 8) |
| Sonnet 5.5 | US$ 0,021 | US$ 6,30 (≈ R$ 35) | US$ 12,60 (≈ R$ 69) |

Conversão a R$ 5,50 por dólar (a cotação padrão do painel de custos). As 6 mensagens do Sonnet foram quase todas a primeira do dia, quando o cache é gravado (o mais caro); numa conversa longa o custo por mensagem cai. Pesquisa diária na web: até US$ 0,05 por envio de buscas, mais os tokens.

**Conclusão:** com Haiku 5.5 como padrão, R$ 39,90 por mês deixa margem folgada mesmo para quem usa muito. Com Sonnet 5.5 para todos, quem manda 20 mensagens por dia custa mais do que paga. Use o Sonnet só se a qualidade do Haiku não bastar, e acompanhe em Admin > Custo da IA.

Some também a taxa da Asaas por cobrança (Pix, boleto e cartão têm taxas diferentes; confira no seu painel) e os impostos do seu regime.

## 4. O modelo

- **Teste grátis de 7 dias, sem cartão.** Fica. É uma das dores do original.
- **Preço fixo por conta, não por mensagem.** Ninguém quer contar mensagem. O limite diário (Admin > Configurações > Limites de uso) protege contra abuso sem aparecer no dia a dia.
- **Mensal no cartão, anual por pagamento único (Pix ou cartão).** O anual não renova sozinho: não existe "fui cobrado de novo sem saber" no anual.
- **Anual com 2 meses grátis** é o padrão do mercado. Hoje o anual dá 25% (R$ 359, quase 3 meses grátis).

## 5. Recomendação: dois níveis, por quem usa

| | **Pessoal** | **Casa** |
| --- | --- | --- |
| para quem | uma pessoa | casal ou família que divide as contas |
| WhatsApps | 1 | até 3, cada um com o nome de quem usa |
| mensal | R$ 39,90 | R$ 59,90 |
| anual (2 meses grátis) | R$ 399 | R$ 599 |
| tudo do app | sim | sim |

Por quê:

- **Pessoal a R$ 39,90** fica abaixo do original (R$ 49,90) e de quem faz o pacote completo, sem ser o "barato que desconfia". Os avaliadores não pediram preço menor.
- **Casa** usa o que já existe (vários WhatsApps, gasto marcado com quem lançou) e cobra por isso, em vez de dar os números extras de graça no plano anual, como hoje.
- Dois níveis bastam. Um terceiro ("Empresa") só quando alguém pedir.

**Hoje o código tem só Mensal (R$ 39,90) e Anual (R$ 359)**, e o número de WhatsApps sai do período (padrão: mensal 2, anual 3). A landing nova mostra exatamente isso, porque é o que existe. Para lançar Pessoal e Casa é preciso mudar o código: plano com nível e período, checkout com o valor certo, limite de WhatsApps pelo nível e a tela de planos. É uma mudança média; faça só se aprovar esta tabela.

Configurações que valem já, sem código:

1. **Modelo:** deixe o Haiku 5.5 como padrão (Admin > Configurações > Modelo).
2. **Teto diário de custo por pessoa:** baixe de US$ 2 para **US$ 0,30** (Admin > Configurações > Limites de uso). Com o Haiku isso dá mais de 100 mensagens por dia, e o pior caso do mês fica abaixo do preço.
3. **Anual:** se quiser seguir o padrão de 2 meses grátis, R$ 399 (hoje R$ 359). Muda em `lib/plans.ts`.

## 6. Cobrança sem surpresa (o que o original erra)

| prática | situação |
| --- | --- |
| cancelar em um toque, com comprovante e protocolo | pronto (F1) |
| cobrança que chega depois do cancelamento é estornada sozinha | pronto (F1) |
| pagamento em confirmação não bloqueia o acesso | pronto (F2) |
| 7 dias grátis sem cartão | pronto |
| anual sem renovação automática | pronto (pagamento único) |
| aviso por e-mail antes da cobrança mensal e 7 dias antes do fim do anual | **falta**. Recomendo fazer antes de abrir para o público |
| sem salto de preço por pessoa | sim: o número de WhatsApps vem do plano, não de cobrança extra |

## 7. Produtos na cobrança

A Asaas é chamada com o valor de cada plano direto do código (`lib/plans.ts`). Não há produto para cadastrar no painel. Stripe não é usado.
