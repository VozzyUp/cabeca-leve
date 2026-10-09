# Bugs

Rodada de 2026-10-08. Base: `2ce673e` (antes de qualquer correção).
Ambiente: Chromium do Playwright 1.56, 1440 px e Pixel 7. Supabase local; UAZAPI e Asaas falsas.
Só entra aqui o que foi reproduzido. Cada correção tem um teste que falhava antes e passa depois.

| id | severidade | o quê | estado |
| --- | --- | --- | --- |
| BUG-002 | S1 | login manda para site de fora com `voltar=/\…` | corrigido |
| BUG-007 | S2 | mensagens que chegam juntas se perdem (erro 500) e os turnos se misturam | corrigido |
| BUG-008 | S2 | depois de 500 mensagens, a conversa para de mostrar as novas | corrigido |
| BUG-009 | S3 | o tempo real apaga da tela a mensagem que está saindo e o aviso de limite | corrigido |
| BUG-001 | S3 | limite de mensagens: a mensagem some sem explicação | corrigido |
| BUG-004 | S3 | mensagens duplicadas quando o tempo real recarrega no meio de um envio | corrigido |
| BUG-003 | S3 | dias fora do mês no calendário sem contraste suficiente | corrigido |
| BUG-006 | S3 | sessão vencida com a tela aberta: a pessoa fica presa vendo "Sessão expirada" | corrigido |
| BUG-010 | S4 | mudar dois ajustes seguidos desfaz o primeiro na tela | corrigido |
| BUG-011 | S1 | a conversa não responde em produção: 22 ferramentas estritas, a API aceita 20; depois 23 parâmetros nulos; depois gramática grande demais | corrigido |
| BUG-012 | S2 | lembrete concluído não volta a ficar ativo: "Não deu para carregar os lembretes" | corrigido |
| BUG-013 | S3 | configuração salva ou apagada na tela podia continuar com o valor antigo até 30 s (leitura juntada a outra em andamento) | corrigido |
| BUG-005 | S4 | criar lembrete antes de a lista carregar diz "Escolha o dia e a hora" com tudo preenchido | corrigido |

### BUG-002: o login leva para um site de fora (redirecionamento aberto)

- Severidade: S1 (falha de segurança: um link de phishing com o seu domínio manda a pessoa, já logada, para outro site)
- Fluxo / caso: F15 / F15-N2
- Tela: S31 (/entrar)
- Build: a46397f. Navegador: Chromium, 1440 px

Passos
1. Abrir `/entrar?voltar=%2F%5Cevil.example%2Fx`, que é `voltar=/\evil.example/x`.
2. Entrar com e-mail e senha certos.

Esperado: ir para `/conversa`, dentro do app.
Atual: o navegador vai para `http://evil.example/x`.
Evidência: teste `F15-N2 voltar=/\evil.example/x não leva para fora do app`, que recebia o host `chromewebdata` (página de erro de DNS do evil.example). O console mostrava "Failed to fetch RSC payload for http://evil.example/x".
Causa: a checagem aceitava qualquer coisa que começasse com `/` e não com `//`. O navegador trata `/\` como `//`. O link de confirmação de e-mail (`/auth/confirm?next=`) tinha a mesma checagem.
Correção: `safeAppPath()` em `lib/validation.ts` resolve o caminho como o navegador resolveria e confere a origem. É usada nos dois lugares. Testes: `lib/validation.test.ts`, que cobre 9 formas de escapar, e os 3 casos F15-N2.
Status: corrigido em 5df5ca0

### BUG-001: no limite de mensagens, a mensagem some sem explicação

- Severidade: S3 (dá para contornar esperando um minuto, mas parece que o app engoliu a mensagem)
- Fluxo / caso: F01 / F01-N1
- Tela: S02 (/conversa)
- Build: 2ce673e. Navegador: Chromium, 1440 px

Passos
1. Mandar 12 mensagens no mesmo minuto.
2. Mandar a 13ª pela tela: "gastei 7 no chiclete".

Esperado: a mensagem continua na tela, e o assistente responde "Muitas mensagens em pouco tempo. Espere um minutinho e mande de novo."
Atual: a mensagem some e nenhuma resposta aparece. A API devolvia as duas últimas mensagens já gravadas (12ª pergunta e resposta), e a tela trocava a mensagem nova por elas.
Evidência: teste `F01-N1`. Antes da correção a resposta da API era `{"messages":[{"text":"oi 11"…`.
Causa: no limite, `respond()` não grava nada (de propósito), e a rota `/api/chat` ignorava a resposta do assistente.
Correção: `respond()` avisa quando não gravou (`stored: false`). A rota então devolve a mensagem e o aviso só para quem mandou, sem gravar.
Status: corrigido em a46397f

### BUG-004: mensagens duplicadas quando o tempo real recarrega no meio de um envio

- Severidade: S3 (a resposta pode aparecer duas vezes até recarregar a página)
- Fluxo / caso: F01 / F01-H1 no celular (X-E3)
- Tela: S02 (/conversa)
- Build: 2ce673e. Aparelho: Pixel 7 (emulado)

Passos
1. No celular, mandar "gastei 35 na padaria e me lembra do mercado às 18h".
2. O tempo real avisa a mudança na tabela de mensagens e recarrega o histórico enquanto a resposta da API ainda está chegando.

Esperado: cada mensagem aparece uma vez.
Atual: o React acusa "Encountered two children with the same key" com o id da mensagem. A mesma mensagem fica duas vezes na lista.
Evidência: teste `F01-H1` no projeto celular, que falhou pelo erro de console.
Causa: ao receber a resposta, a tela juntava as mensagens novas à lista sem conferir se o recarregamento já as tinha trazido.
Correção: `merge()` em `chat-screen.tsx` junta sem repetir id.
Status: corrigido em a46397f

### BUG-003: dias fora do mês no calendário sem contraste suficiente

- Severidade: S3 (difícil de ler com baixa visão; reprova WCAG 1.4.3)
- Fluxo / caso: transversal / X-H1
- Tela: S06 (/dia/calendario)
- Build: 2ce673e. Navegador: Chromium, 1440 px e Pixel 7

Passos
1. Abrir /dia/calendario na visão de mês.

Esperado: todos os números com contraste de pelo menos 4,5:1.
Atual: os dias do mês anterior e do seguinte ficam com `opacity-40` sobre o texto e reprovam no axe (`color-contrast`, serious).
Evidência: teste `X-H1`: `button[data-day="2026-09-27"] > .size-7.font-mono.mx-auto`.
Correção: o número usa a cor `text-muted`, que passa no contraste. A transparência ficou só nos pontinhos.
Status: corrigido em a46397f

### BUG-005: criar lembrete antes de a lista carregar dá a mensagem errada

- Severidade: S4 (basta clicar de novo, mas a mensagem confunde)
- Fluxo / caso: F04 / F04-E3
- Tela: S11 (/lembretes)
- Build: a46397f. Navegador: Chromium, 1440 px, com 3 testes em paralelo (servidor lento)

Passos
1. Abrir /lembretes com a rede ou o servidor lentos.
2. Preencher o texto, o dia e a hora e clicar em Criar antes de a lista aparecer.

Esperado: o botão espera a lista (que traz o fuso da conta) ou cria normalmente.
Atual: aparece "Escolha o dia e a hora." mesmo com os dois preenchidos.
Evidência: teste `F04-E3` na bateria completa. O retrato da página mostra Dia `2026-10-09`, Hora `09:30` e a mensagem de erro.
Causa: a mesma condição tratava "falta dia ou hora" e "a lista ainda não chegou".
Correção: o botão Criar fica desligado até a lista carregar, e a mensagem só aparece quando falta dia ou hora.
Status: corrigido em 5df5ca0

### BUG-006: sessão vencida com a tela aberta prende a pessoa

- Severidade: S3 (recarregar a página resolve)
- Fluxo / caso: F15 / F15-E3
- Tela: qualquer uma que chame a API (S09, S11, S18…)
- Build: a46397f. Navegador: Chromium, 1440 px

Passos
1. Entrar e abrir /tarefas.
2. A sessão some: sair em outro aparelho, senha trocada ou cookie apagado.
3. Escrever uma tarefa e clicar em Adicionar.

Esperado: ir para o login e, depois de entrar, voltar para /tarefas.
Atual: a tarefa não salva e a tela mostra "Sessão expirada. Entre de novo.", sem levar ao login. As chamadas em segundo plano seguem recebendo 401.
Evidência: teste `F15-E3`, que esperou 60 s pela ida ao login. Na bateria completa, o F15-E1 mostrava três 401 no console da tela aberta.
Correção: `lib/api.ts` leva para `/entrar?voltar=<tela atual>` ao receber 401.
Status: corrigido em 5df5ca0

### BUG-007: mensagens que chegam juntas se perdem e os turnos se misturam

- Severidade: S2 (perda de mensagem: quem encaminha várias mensagens no WhatsApp perde parte delas, sem aviso)
- Fluxo / caso: F02 / F02-E5; F01 / F01-N1
- Tela: S02 e o WhatsApp
- Build: a46397f

Passos
1. Mandar 12 mensagens ao mesmo tempo para `/api/chat`, ou 5 pelo webhook do WhatsApp de uma vez.

Esperado: todas gravadas e respondidas, cada pergunta seguida da própria resposta.
Atual: parte das mensagens falha com "Não deu para salvar a mensagem" (500). O F01-N1 em paralelo mostrou isso: só 11 das 12 foram gravadas, e a 13ª passou do limite sem ser barrada.
Evidência: F01-N1 com as 12 mensagens em paralelo, e a leitura do código.
Causa:
- A posição de cada mensagem era calculada no servidor como "a última mais um" e gravada depois. Com várias ao mesmo tempo, elas disputavam o mesmo número e desistiam depois de 3 tentativas.
- Turnos simultâneos também intercalavam as mensagens. Com o agente de verdade, isso quebra o histórico que a API da Anthropic exige em ordem: cada chamada de ferramenta seguida do seu resultado.

Correção (migração `20261008000600_mensagens_simultaneas.sql`):
- `append_message()` calcula a posição dentro do banco, com a conversa travada.
- `acquire_turn()` e `release_turn()` dão um turno por vez a cada conversa. O prazo de 120 s solta a vez se um servidor cair. Quem chega espera até 45 s; depois disso recebe "Ainda estou terminando a resposta anterior".

Testes:
- `supabase-store.int.test.ts`: 15 mensagens juntas ficam com posições seguidas; 3 turnos não se sobrepõem; um turno que falha solta a vez.
- `F02-E5`: 5 mensagens juntas no WhatsApp viram 5 lançamentos e 5 respostas, intercaladas pergunta e resposta.

Status: corrigido em 5df5ca0

### BUG-008: depois de 500 mensagens, a conversa para de mostrar as novas

- Severidade: S2 (para quem usa todo dia, umas 250 trocas: a tela de conversa e a resposta do envio passam a mostrar mensagens antigas)
- Fluxo / caso: F01, encontrado lendo o código durante o BUG-009
- Tela: S02 (/conversa)
- Build: a46397f

Passos
1. Ter 520 mensagens gravadas.
2. Mandar uma nova e abrir a conversa.

Esperado: a nova é a última da lista.
Atual: a lista termina em "antiga 499". A busca pegava as 500 primeiras em ordem crescente, ou seja, as mais antigas.
Evidência: `supabase-store.int.test.ts`, teste "a conversa mostra as 500 mensagens mais recentes", que falhou com `expected 'antiga 499' to be 'a mais nova'`.
Correção: busca em ordem decrescente e inverte.
Status: corrigido em 5df5ca0

### BUG-009: o tempo real apaga da tela a mensagem que está saindo e o aviso de limite

- Severidade: S3 (a mensagem continua gravada no servidor, mas some da tela; se o envio falhar, o botão de reenviar some junto)
- Fluxo / caso: F01 / F01-N1, repetido
- Tela: S02 (/conversa)
- Build: depois da correção do BUG-001

Passos
1. Mandar várias mensagens seguidas, ou ter outro aparelho mandando ao mesmo tempo.
2. Mandar uma pela tela enquanto os avisos do tempo real ainda chegam.

Esperado: a mensagem enviada e a resposta (inclusive o aviso de limite, que não é gravado) continuam na tela.
Atual: o recarregamento troca a lista pela do servidor. Some a mensagem provisória e somem as que só existem na tela.
Evidência: retrato do F01-N1 (repetição 2), com o campo vazio e sem a mensagem "gastei 7 no chiclete" nem o aviso. A mesma chamada direto na API respondeu em 0,5 s com o aviso.
Correção: `useResource` aceita um `combine`. A conversa mantém as mensagens só da tela (enviando, com erro ou aviso de limite). A provisória sai quando a gravada, com o mesmo `clientId`, chega do servidor.
Status: corrigido em 5df5ca0

### BUG-010: mudar dois ajustes seguidos desfaz o primeiro na tela

- Severidade: S4 (o banco grava certo; só a tela mostra o valor antigo até recarregar)
- Fluxo / caso: F19 / F19-H1
- Tela: S30 (/ajustes/assistente)
- Build: a1cc3ef. Navegador: Chromium, 1440 px, bateria completa

Passos
1. Escolher o tom "Divertido".
2. Logo em seguida, escolher o tema "Claro".

Esperado: os dois marcados.
Atual: "Divertido" volta para o tom anterior na tela, porque cada mudança partia de uma cópia antiga dos ajustes. O teste também recarregava antes da segunda gravação, assim que aparecia o primeiro "Salvo".
Evidência: F19-H1 falhou na bateria completa (`toBeChecked` em "Claro" depois de recarregar).
Correção: o estado é atualizado a partir do mais novo, e reverter um erro volta só os campos daquela mudança. O teste agora confere os dois marcados na hora e espera as duas gravações no banco.
Status: corrigido no commit das correções F5 a F7

### BUG-011: a conversa não responde em produção (22 ferramentas estritas, o limite é 20)

- Severidade: S1 (nenhuma mensagem é respondida com a chave real da Anthropic)
- Fluxo / caso: F01 (conversa), achado no primeiro uso em produção
- Build: f3d27df. Ambiente: VPS, chave real
- Esperado: o assistente responde.
- Atual: "Não consegui responder agora". O log do servidor trazia `400 invalid_request_error: Too many strict tools (22). The maximum number of strict tools supported is 20.`
- Por que os testes não pegaram: eles usam uma resposta simulada da Anthropic, que não conhece o limite. A afirmação do teste era "todas as ferramentas são estritas", o que escondia o problema.
- Correção: `get_day_overview` e `query_categories`, que não têm parâmetros (nada a validar), deixam de ser estritas, e sobram 20. O teste agora confere no máximo 20 estritas e que só as sem parâmetro ficam de fora. Em seguida a API recusou 23 parâmetros "pode ser nulo" nas ferramentas estritas (limite 16): `update_transaction`, `update_task` e `query_transactions` deixam de ser estritas (o zod continua validando a entrada) e o teste confere os dois limites. Por fim a API recusou a gramática compilada (grande demais). Como cada ajuste revelava um limite novo, o modo estrito saiu de todas as ferramentas: o Zod confere a entrada antes de cada uma rodar e o erro volta para o modelo corrigir (o SDK faz isso). A tela de admin ganhou "Testar chave", que reproduz o turno real e mostra o erro da Anthropic.
- Status: corrigido

### BUG-012: lembrete concluído não volta a ficar ativo

- Severidade: S2 (concluir sem querer não tem volta; a tela mostra erro)
- Fluxo / caso: F04 / F04-E4, achado no primeiro uso em produção
- Tela: S11 (/lembretes)
- Passos: 1. Ter um lembrete (o do caso repete toda quarta). 2. Marcar como concluído. 3. Em "Concluídos", desmarcar.
- Esperado: o lembrete volta para "Próximos".
- Atual: volta ao estado de concluído e aparece "Não deu para carregar os lembretes". O banco tem a regra `status <> 'active' or next_fire_at is not null`; ao concluir, o app apagava a data do aviso, então ao reabrir não havia data para devolver e a gravação falhava. Valia para todo lembrete.
- Por que os testes não pegaram: o banco simulado dos testes de tela não tem essa regra, e nenhum teste reabria um lembrete no banco real.
- Correção: concluir agora guarda a data do aviso (a varredura só olha os ativos). Reabrir usa a data guardada; se já passou e o lembrete repete, a próxima ocorrência; se não repete, fica como atrasado. Lembrete concluído antes da correção (sem data) reabre na próxima hora cheia, ou na próxima ocorrência da repetição. Testes: `reopenFireAt` (unidade), concluir e reabrir no banco real (integração, falha sem a correção) e F04-E4 (tela).
- Status: corrigido

### BUG-013: configuração salva ou apagada podia continuar com o valor antigo

- Severidade: S3 (some sozinho em até 30 s; mas "vale na hora" não valia sempre)
- Fluxo / caso: ADM-H1 e ADM-H2, achado ao rodar a tela de custos
- Esperado: depois de salvar ou apagar uma chave na tela de admin, o app já usa o valor novo.
- Atual: se uma leitura periódica da configuração já estava em andamento, a leitura forçada depois da gravação se juntava a ela e devolvia o valor de antes da gravação.
- Correção: leituras forçadas entram numa fila e começam depois da leitura em andamento; a periódica aproveita a que já está rodando.
- Observação de teste: dois testes de admin falharam também por causa dos testes, não do app: o F3 apaga e recria a conta "dono" em outro processo (derrubava a sessão do teste de admin), e o login do teste navegava com a conversa ainda carregando. O admin.spec agora tem conta própria e o login espera a página assentar.
- Status: corrigido

## Para conferir (não reproduzido como falha visível)

- **Conta apagada com a página aberta em outro aparelho.** A tela vai para o login (F18-E1 passa), mas o servidor registra "Sessão expirada" e "Cannot coerce the result to a single JSON object" como erros não tratados. Isso aconteceu enquanto os testes apagavam as contas no fim. Vale tratar com uma resposta 401 limpa, para não poluir o monitor de erros.
- **Compra no crédito sem cartão cadastrado** sai do saldo da conta, porque não há fatura onde lançar. Com cartão cadastrado funciona (F05-E1). Decisão de produto: perguntar "qual cartão?" ou criar um cartão padrão na primeira compra no crédito.
- **Cancelar a assinatura** não pede confirmação: é um toque só, de propósito (F1 do `fixes.md`). Talvez valha um "tem certeza?" para evitar toque sem querer no celular.
