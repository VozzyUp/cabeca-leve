# Plano de lançamento

Data: 2026-10-14. Ângulo: "o assistente que responde quando você precisa" (`fixes.md`). Preço: `pricing.md`. Landing: `landing.md`. Lojas: `listing.json` (o `listing.py` passa sem erro nem aviso).

## 0. Antes de abrir para o público

| item | situação |
| --- | --- |
| landing em `/` com a captura do app de verdade | pronto (`app/(public)/page.tsx`) |
| termos e privacidade | pronto; **falta a revisão de um advogado** e os dados da empresa em Admin > Configurações |
| teste grátis, cancelar com comprovante, estorno automático, pagamento em confirmação | pronto (F1, F2) |
| suporte com protocolo | pronto (F3) |
| custo por pessoa sob controle | Haiku 5.5 como padrão e teto diário de US$ 0,30 (`pricing.md`, seção 5) |
| aviso antes da cobrança mensal e 7 dias antes do fim do anual | **falta** |
| monitor de erros em produção (Sentry ou parecido) | **falta**. Hoje um erro só aparece no log do container. É o que teria explicado o "Internal Server Error" de 2026-10-14 na hora |
| medição de uso na landing (visitas, cadastros, assinaturas) | **falta**. Use uma ferramenta sem cookie de propaganda, para não precisar mudar a política |
| número do assistente na API oficial da Meta | **falta** (F7). Antes de crescer: a UAZAPI usa um número comum, que pode ser bloqueado |
| logo definitivo e imagem social 1200 × 630 | **falta** (briefing em `brand.md`) |

## 1. Beta fechado (2 a 4 semanas)

- Lista de espera: um formulário simples (nome, e-mail, WhatsApp, "o que você quer tirar da cabeça?"). Pode ser uma seção na landing ou um formulário externo.
- Convide de 20 a 50 pessoas por mês, com o teste grátis de 7 dias. Quem ficar, entra com desconto de fundador (decida o valor antes e diga por quanto tempo vale).
- Cada semana: olhe Admin > Custo da IA, os chamados de suporte e as revisões que falharam. Refaça a conta do `pricing.md` com os números reais.
- Peça permissão por escrito antes de usar qualquer frase de beta na página. Só com permissão vira depoimento.

## 2. As primeiras 10 pessoas, uma por uma

Fale com cada uma por WhatsApp ou chamada, depois de 3 e de 7 dias:

1. O que você pediu primeiro? Deu certo?
2. Em que momento você quase desistiu?
3. O que você esperava que ele fizesse e ele não fez?
4. Você pagaria? Quanto parece justo?

Anote tudo em `replica/launch/entrevistas.md` (crie quando começar). Três pessoas tropeçando no mesmo lugar é a próxima tarefa.

## 3. Onde estão as pessoas insatisfeitas com o original

Da pesquisa (`fixes.md`): as reclamações aparecem nas avaliações da App Store e do Google Play. O Reddit e o Reclame Aqui foram bloqueados para a pesquisa e **não foram lidos**: confira antes de investir tempo neles.

- **Não** responda avaliações nem perfis do original para oferecer o seu app. É mal visto e pode virar problema com as lojas.
- O que funciona é estar onde a pessoa procura alternativa: busca por "assistente pessoal no WhatsApp", "app para organizar contas pelo WhatsApp", "lembrete pelo WhatsApp". Um texto honesto por tema, no seu site, com o que o app faz e o que não faz.
- Grupos e comunidades de organização pessoal e finanças: participe primeiro, divulgue depois, e só onde as regras do grupo permitem.

## 4. Anúncio de lançamento

Product Hunt e Hacker News são em inglês e o app é só em português: rendem pouco agora. Melhor:

- **Post de lançamento** no seu LinkedIn, Instagram e X, em português, que começa pela correção, não pelo produto:
  > "Assistente pessoal que, quando trava, tem uma pessoa de verdade para responder. Com protocolo e prazo. E cancelar é um toque, com comprovante."
  Depois: um vídeo de 20 segundos no celular, do gasto anotado pelo WhatsApp ao card no app.
- Linha de anúncio alternativa (ângulo C do `fixes.md`): "Anote gastos pelo WhatsApp. Os números batem."
- Não use o nome de nenhum concorrente em anúncio, título ou palavra-chave. Comparação direta é assunto para advogado.

## 5. Lojas (App Store e Google Play)

**Hoje o app é web (instala pela tela inicial) e WhatsApp. Não há app nativo.** O texto está pronto em `listing.json` para quando houver:

- **Google Play:** dá para publicar o app web como Trusted Web Activity (um app Android que abre o site), com pouco código.
- **App Store:** a Apple costuma recusar app que é só um site embrulhado (diretriz 4.2, funcionalidade mínima). Precisa de algo nativo de verdade, como notificação e widget. Avalie o custo antes.

Quando for publicar, prepare:

- capturas nos tamanhos pedidos no momento (confira no App Store Connect e no Play Console, eles mudam), mostrando nas duas primeiras as correções: "uma pessoa de verdade" e "cancelou, parou";
- rótulos de privacidade (Apple) e formulário de segurança de dados (Google), coerentes com `/privacidade`: dados de contato, conteúdo do usuário, dados financeiros informados pela pessoa, diagnóstico; nada vendido, nada para propaganda;
- URL de privacidade: `https://cabeca.vozzyup.com.br/privacidade`; URL de suporte: uma página pública de contato (hoje o suporte fica dentro do app; crie uma página `/suporte` aberta antes de enviar);
- classificação etária: responda o questionário com honestidade (conversa com IA e dados financeiros);
- notas para a revisão com uma conta de demonstração já com dados, e um número de WhatsApp de teste, explicando que o assistente nunca acessa o WhatsApp da pessoa;
- compras: a Apple exige compra dentro do app para assinatura digital usada no iPhone. Hoje a cobrança é pela Asaas. Isso muda o modelo e as taxas, e precisa ser decidido antes de ir para a App Store.

## 6. Depois do lançamento

- Toda semana: cadastros, quem passou do teste para pago, cancelamentos com o motivo, custo médio por pessoa, chamados abertos e o tempo até a resposta.
- Todo mês: rode de novo o `/replica-entrepreneur` com as avaliações novas e refaça a lista de correções.
- Próximo passo da série: `/replica-deploy`, para a checagem final de produção (domínio, e-mail, monitor de erros, cobrança em modo real).
