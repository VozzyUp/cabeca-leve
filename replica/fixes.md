# O que corrigir do original

Pesquisa feita em 2026-10-08. Os relatórios completos estão em `feedback.md` (original) e `feedback-categoria.md` (concorrentes).

## Amostra (pequena: leia os números com cuidado)

| fonte | avaliações | como foi lida |
| --- | --- | --- |
| App Store do original | 33 (todas as avaliações escritas; a loja mostra 53 notas) | feed oficial de avaliações da Apple, loja do Brasil |
| Google Play do original | 3 (só as que aparecem na página; a loja diz ~111) | página pública aberta uma vez, como uma pessoa |
| App Store da Zapia (concorrente) | 124 | feed oficial da Apple |
| App Store do Meu Assessor IA (concorrente) | 6 | feed oficial da Apple |
| Reddit, Reclame Aqui | 0 | **bloqueados** para este ambiente (403); não lidos |
| Hacker News | 0 | nenhuma menção |

**Original: 36 avaliações em 2 fontes** (18 de 5 estrelas, 12 de 1 estrela; 17 com 3 estrelas ou menos; de 2025-08-06 a 2026-08-22).
Ficou abaixo da meta de 100 em 3 fontes. Por isso cada tema do original com uma fonte só está marcado como **fino**.
As 130 avaliações dos concorrentes servem para confirmar dores da categoria, não do original.
Para engrossar: abrir o Reclame Aqui e o Google Play ("Ver todas as avaliações") no navegador e copiar as linhas para `reviews.csv`, depois rodar de novo:

```bash
python3 ~/.claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --themes replica/themes-ptbr.json --out replica/feedback.md
```

A App Store não tem link para cada avaliação. Por isso o link de cada citação é a página de avaliações do app. O título e o texto foram copiados como estão, separados por uma quebra de linha.

## 1. O que eles odeiam

1. **Falhas e erros: "adicionam funcionalidades sem corrigir"**. São 7 avaliações em 2 fontes, com média de 2,0 estrelas. Na categoria aparecem mais 8.
   - "Adicionam funcionalidades sem corrigir as falhas de antes. Não vai pra frente assim." (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
   - "tem tudo para dar certo e ser o melhor porém no momento ainda não dá para utilizar" (Google Play, 3★) https://play.google.com/store/apps/details?id=com.wnapp.id1751730637210&hl=pt_BR
2. **Suporte que não responde, ou que é só robô**. São 5 avaliações em 1 fonte (**fino**), média de 1,8. Na categoria há mais 5, em 2 fontes.
   - "o suporte é um chatbot tão ruim quanto, que não resolve nada e mesmo falando “quero suporte humano”, isso não existe!" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
   - "eles pedem até 48 horas e esperei por mais de 6 dias…" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
3. **Pagou e não entra, ou o cadastro trava**. São 4 avaliações em 1 fonte (**fino**), todas de 1 estrela.
   - "assim que confirmei o email para o cadastro já cai numa tela que me dizia que a minha assinatura era inválida" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
   - "O valor saiu da conta, mas ao tentar acessar não pega. Diz que é inválido!" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
4. **Finanças: relatório que não bate, teto de gastos ruim, busca que não acha**. São 4 avaliações em 2 fontes, média de 2,2.
   - "muita das vezes o relatórios Não batem com o relatório real" (Google Play, 3★) https://play.google.com/store/apps/details?id=com.wnapp.id1751730637210&hl=pt_BR
   - "Vc registra tudo e depois pede para fazer uma simples busca do que foi registrado a instantes atrás e ele não consegue fazer essa busca." (Google Play, 2★) https://play.google.com/store/apps/details?id=com.wnapp.id1751730637210&hl=pt_BR
   - "A forma de colocar teto nos gastos para ir acompanhando se esta para bater o limite ta muito ruim!" (App Store, 3★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
5. **Cobrança depois de cancelar**. São 3 avaliações em 1 fonte (**fino**), todas de 1 estrela. Na categoria há mais 3, em 2 fontes.
   - "Cancelei minha assinatura no mes 11 de 2025 e continua cobrando no meu cartão!" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
6. **Sem como testar antes de pagar**. São 2 avaliações em 1 fonte (**fino**).
   - "deveriam pelo menos colocar um período de avaliação gratuita" (App Store, 1★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
7. **Lembretes que não chegam**. São 2 avaliações da mesma pessoa em 1 fonte (**fino**), ambas de 3 estrelas.
   - "Os lembretes não funcionam. O app até tem uma boa proposta mas sem funcionar notificações pra mim não funciona" (App Store, 3★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews

## 2. O que falta

Nenhum pedido se repete no original: todos os temas são **finos**.

- Widgets e sincronia com os Lembretes do iOS: 1 avaliação. "Já planos para sincronia com o reminders do iOS? Senti falta de widgets também." (App Store, 4★) https://apps.apple.com/br/app/n%C3%A9ctar/id6748546755?see-all=reviews
  Os dois exigem app nativo. Ficam fora da v1, que é web + WhatsApp.
- Na categoria há 1 pedido de cada: ditar por voz, "me ligue", versão para iPad, conector do Instagram e dois números de WhatsApp.

## 3. O que ninguém resolve

- **Usar o assistente sem pôr o próprio WhatsApp em risco.** Isso só aparece na categoria, com 5 avaliações de banimento e 4 de privacidade e golpes, todas da Zapia (**fino**: 1 fonte). Os apps que se conectam à conta de WhatsApp da pessoa levam a culpa quando a conta cai.
  - "Infelizmente ao utilizar o aplicativo meu WhatsApp foi bloqueado 2x em cerca de 1 mês por violar regras de uso do app." (App Store, Zapia, 2★) https://apps.apple.com/br/app/id6470821480?see-all=reviews
  - "Nem autorizei ele já começou a agir no meu watsap." (App Store, Zapia, 1★) https://apps.apple.com/br/app/id6470821480?see-all=reviews

  O seu app já funciona de outro jeito: a pessoa conversa com o **número do assistente** e nunca conecta a conta dela. O risco de bloqueio fica no número do assistente, que usa a UAZAPI. Por isso a migração para a Meta (F7) importa.
- **Gente que pagou e precisa de uma pessoa.** No original, 12 das 36 avaliações (um terço) falam de suporte, cobrança, acesso ou teste. Todas vêm da App Store, então o tema é **fino** pelo critério de fontes. Na categoria ele se repete em 2 fontes.

## 4. Plano de correções

Ordem: evidência × custo. Questões de preço e de política de reembolso vão para o `/replica-launch`.

| # | o que fazer | tamanho | skill | evidência | já existe no clone |
| --- | --- | --- | --- | --- | --- |
| F1 | **Cancelar com comprovante.** Ao cancelar: tela e e-mail com "acesso até dd/mm, nenhuma cobrança nova". Se chegar `PAYMENT_CONFIRMED` de uma assinatura cancelada, gerar alerta e estorno automático. | S | `/replica-backend` | cobrança, 3 + 3 | cancelar em um toque, já pronto |
| F2 | **Pagamento em confirmação não bloqueia.** A tela de obrigado acompanha o status ao vivo. Enquanto a Asaas não confirma, mostrar "confirmando pagamento" e manter o acesso. Nunca mostrar "assinatura inválida". Teste de ponta a ponta do cadastro até a primeira mensagem. | S | `/replica-backend`, `/replica-test` | acesso, 4 (fino) | teste de 7 dias sem cartão, já pronto |
| F3 | **Falar com uma pessoa.** Em Ajustes e no chat ("quero falar com um humano"): abre um chamado com protocolo, prazo de resposta visível e aviso para você por e-mail ou WhatsApp. O assistente não finge ser o suporte. | M | `/replica-backend` | suporte, 5 (fino) + 5 | não |
| F4 | **Não lançar com falhas.** Bateria de testes com pedidos reais em português (gastos, buscas por período, lembretes, edição e exclusão), rodada antes de cada versão. Monitor de erros em produção. | M | `/replica-test` | falhas, 7 em 2 fontes | 44 de unidade, 23 de integração, verificações no navegador |
| F5 | **Teto por categoria que funciona.** "iFood: teto R$ 500, gasto R$ 300 (60%)", com aviso em 80% e 100%. Os totais vêm sempre do banco, nunca de conta feita pela IA. | M | `/replica-build` | finanças, 4 em 2 fontes | tabela `budgets` existe; tela não. Busca por texto e período, já pronta |
| F6 | **Lembrete que chega.** Botão "testar aviso agora" (push e WhatsApp) com o resultado na tela. Se o push falhar, o lembrete sai pelo WhatsApp. | S | `/replica-backend` | lembretes, 2 (fino) | entrega por push e WhatsApp, já pronta |
| F7 | **Seu WhatsApp não corre risco.** Dizer no cadastro e nos Ajustes: "você conversa com o nosso número; nunca pedimos acesso ao seu WhatsApp". O assistente nunca escreve para terceiros. Migrar o número para a API oficial da Meta antes de crescer. | S (texto) + M (Meta) | `/replica-brand`, `/replica-backend` | categoria, 5 + 4 (fino) | arquitetura já é essa; envio por modelo da Meta, não |

Todas as linhas estão no `features.csv` com `original = no`. A exceção é o teto de gastos: ele já tinha linha, porque o original tem a função (mal feita). Ali só subi a prioridade de could para should.

## 5. Posicionamento

**A. O assistente que responde quando você precisa (recomendado)**
Para quem pagou um assistente e ficou sem resposta, sem acesso ou cobrado depois de cancelar, este app tem teste de 7 dias sem cartão, cancelamento em um toque com comprovante e uma pessoa de verdade no suporte.
Evidência: suporte, cobrança, acesso e teste somam 12 de 36 avaliações do original, todas na App Store (fino pelo critério de fontes). Suporte e cobrança se repetem em 2 fontes da categoria.

**B. Seu WhatsApp fica intacto**
Para quem tem medo de ligar um app de IA no próprio WhatsApp, este app é um contato a mais: você manda mensagem para ele e ele não toca na sua conta.
Evidência: banimento e privacidade, 9 avaliações de 1 fonte (Zapia; fino). Só vale depois de migrar o número do assistente para a Meta.

**C. Contas que batem**
Para quem anota gastos pelo chat e recebe relatório errado, aqui os números vêm do banco, a busca acha o que você anotou e o teto avisa antes de estourar.
Evidência: finanças, 4 avaliações em 2 fontes do original.

**Recomendação: A.** É a dor mais frequente e a mais cara do original (12 de 36, média de 1 estrela). Quase tudo já está pronto no clone, e o que falta (F1, F2, F3) é pequeno. B entra como argumento de apoio quando a Meta estiver ligada, e C é uma boa linha de anúncio.
Não use o nome do original no nome do app, em anúncios nem na loja. Uma página de comparação é assunto para advogado.
As frases dos avaliadores são pesquisa, não depoimento: não vão para a página de vendas.
