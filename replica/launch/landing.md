# Landing page

Data: 2026-10-14. Ângulo: **A. O assistente que responde quando você precisa** (`fixes.md`, seção 5). Voz: leve, direta, presente (`brand.md`).
Construída em `app/(public)/page.tsx`. A captura é do app de verdade (`public/landing/conversa.png`, gerada pelo Playwright com uma conta de teste).

Regras seguidas: sem depoimento, sem número de usuários, sem nota de loja, sem logo de imprensa. Nenhuma frase de avaliador. O nome do original não aparece.

## 1. Topo

- **Título:** Seu assistente no WhatsApp. E uma pessoa de verdade quando você precisar.
- **Linha de baixo:** Tarefas, lembretes e dinheiro numa conversa. 7 dias grátis sem cartão, cancelamento em um toque com comprovante.
- **Botão:** Começar 7 dias grátis → `/entrar?modo=criar`
- **Ao lado:** captura da conversa (lançamento, lembrete e tarefa criados, com Desfazer).
- **Embaixo:** "Você conversa com o nosso número. Nunca pedimos acesso ao seu WhatsApp."

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

Depois, numa linha menor, o que é preço de entrada: treino e alimentação, metas e hábitos, pesquisa diária na internet, cofre de senhas, conta para o casal ou a família.

## 5. Preço

Os planos que existem hoje (`lib/plans.ts`): Mensal R$ 39,90 e Anual R$ 359, com 7 dias grátis. O número de WhatsApps de cada plano vem da configuração (padrão: mensal 2, anual 3). Link para `/planos`.
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
