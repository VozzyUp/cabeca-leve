# Landing page

Data: 2026-10-14; topo e bloco novo reescritos em 2026-10-15, com o nome Peraí e o duplo foco (organização e TDAH). Ângulo da página: **A. O assistente que responde quando você precisa** (`fixes.md`, seção 5), agora sob a frase "Peraí, o que eu ia fazer mesmo?". Voz: sem pressa, parceiro, direto (`brand.md`).
Construída em `app/(public)/page.tsx`. A captura é do app de verdade (`public/landing/conversa.png`, gerada pelo Playwright com uma conta de teste; refeita em 2026-10-15 para mostrar o nome Peraí no topo).

Regras seguidas: sem depoimento, sem número de usuários, sem nota de loja, sem logo de imprensa. Nenhuma frase de avaliador. O nome do original não aparece.

## 1. Topo

- **Título:** Peraí, o que eu ia fazer mesmo?
- **Linha de baixo:** O assistente no WhatsApp que guarda o que passa pela sua cabeça: tarefas, lembretes e contas, numa conversa. Para quem se perde no meio do dia, com ou sem TDAH. E uma pessoa de verdade quando você precisar. Embaixo, em letra menor: 7 dias grátis sem cartão, cancelamento em um toque com comprovante.
- **Botão:** Começar 7 dias grátis → `/entrar?modo=criar`
- **Ao lado:** captura da conversa (lançamento, lembrete e tarefa criados, com Desfazer).
- **Embaixo:** "Você conversa com o nosso número. Nunca pedimos acesso ao seu WhatsApp."

## 1b. Feito para cabeças que não param (novo)

Quatro cartões, só com o que o app faz hoje: **Mande do jeito que vier** (áudio, frase solta, foto da nota; card com Desfazer), **Lembrete que volta** (Feito e Adiar, no celular e no WhatsApp, sem bronca), **Um passo de cada vez** (respostas curtas, quebrar tarefa grande em passos pequenos) e **Do seu jeito, sem julgamento** (escolher o tom; nunca humilha). Embaixo, o aviso: o app é ferramenta de organização, não faz diagnóstico, não trata TDAH e não substitui acompanhamento profissional. Nada de promessa de tratamento, número de usuários ou depoimento. A dúvida "É um app para TDAH?" abre a lista de dúvidas, e a chamada final virou "Anote antes que escape".

## 2. O problema

Título: **Assistente que some na hora que você mais precisa**

Os dois temas que mais pesam contra o original, em palavras nossas:

1. **Você pagou e ficou sem resposta.** Acesso que não libera, suporte que é só robô, cobrança que continua depois de cancelar.
2. **Você anota e ele não acha.** Lembrete que não chega, relatório que não bate com o que você lançou.

## 3. Como funciona

1. **Crie a conta.** 7 dias grátis, sem cartão.
2. **Vincule o WhatsApp.** Você conversa com o número do assistente.
3. **Fale do seu jeito.** Texto, áudio ou foto. Ele organiza e confirma com um card que dá para desfazer.

## 4. O que é diferente (cada item é uma correção do `fixes.md`)

| correção | na página |
| --- | --- |
| F3 | **Uma pessoa de verdade.** Peça na conversa ou em Configurações: o chamado tem protocolo e alguém do time responde em até 1 dia útil. O assistente nunca finge ser o suporte. |
| F1 | **Cancelou, parou.** Um toque em Configurações, comprovante com protocolo na hora. Se uma cobrança chegar depois, ela é estornada sozinha. |
| F2 | **Pagou, entrou.** Enquanto o pagamento confirma, o acesso continua. Nada de "assinatura inválida". |
| F6 | **Lembrete que chega.** No celular e no WhatsApp, com Feito e Adiar. Dá para testar o aviso na hora, em Configurações. |
| F5 | **Conta que bate.** Os totais vêm do que você lançou, não de um palpite da IA. Teto por categoria avisa em 80% e 100%. |
| F7 | **Seu WhatsApp fica intacto.** Você manda mensagem para o assistente; ele não entra na sua conta nem escreve para os seus contatos. |

Os recursos que só pareciam "o resto" agora têm seção própria logo depois do topo (ver abaixo).

## 4b. Tudo o que cabe na sua cabeça (logo após o topo)

Seção `tudo`, h2 **"Tudo o que cabe na sua cabeça, num lugar só"**, com a frase "É só falar no WhatsApp, por texto, áudio ou foto" e 10 cartões, cada um com ícone, título, o que faz e (quando há conversa) a frase que a pessoa manda: Tarefas e lembretes, Dinheiro, Treino e alimentação, Hábitos e metas, Documentos e reembolso, Pesquisa diária, Projetos/notas/foco, Seu dia num lugar, Cofre de senhas (só no app, sem frase) e Casal e família. O topo também ganha uma linha de temas (Tarefas, Lembretes, Dinheiro, Treino e dieta, Hábitos e metas, Documentos e reembolso, Pesquisa diária, Cofre de senhas) e um botão de começar logo abaixo dos cartões. Só recurso que existe: sem sincronizar com Google/Outlook e sem promessa de tratamento.

## 5. Preço

Os planos à venda vêm do banco (Administração > Planos e limites); hoje: Mensal R$ 39,90 e Anual R$ 359, com 7 dias grátis. O número de WhatsApps de cada plano é um dos limites do plano (padrão: mensal 2, anual 3). Link para `/planos`.
Se aprovar os níveis Pessoal e Casa de `pricing.md`, esta seção muda junto.

## 6. Dúvidas

- **Posso testar antes de pagar?** Sim, 7 dias, sem cartão. No fim, você escolhe se assina. Tudo o que anotou continua guardado.
- **E se eu quiser cancelar?** Um toque em Configurações. Comprovante na hora, nenhuma cobrança nova, acesso até o fim do período pago. Cobrança que chegar depois é estornada sozinha.
- **Vocês acessam o meu WhatsApp?** Não. Você conversa com o número do assistente; ele não entra na sua conta.
- **Paguei e não liberou. E agora?** O acesso continua enquanto o pagamento confirma. Se algo travar, peça uma pessoa: o chamado tem protocolo.
- **Consigo trazer o que eu já tenho em outro app?** Ainda não há importação automática. Dá para mandar a lista de contas fixas e lembretes pela conversa, que ele cadastra.
- **A IA pode errar?** Pode. Cada coisa que ela registra vem num card com Desfazer, e os totais vêm do que foi lançado.

## 7. Chamada final

**Tire a vida da cabeça hoje.** Botão: Começar 7 dias grátis.

## Contraste

A página usa só os tokens da marca (`app/tokens.css`), já conferidos pelo `contrast.py` do replica-design: 23 pares em cada tema, nenhuma falha AA (`brand.md`). A varredura de acessibilidade (axe) roda na página no teste `X-H2`.
