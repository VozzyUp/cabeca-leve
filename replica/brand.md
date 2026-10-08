# Marca

Data: 2026-10-08. O posicionamento vem do `fixes.md`: "o assistente que responde quando você precisa". Para quem pagou e ficou sem resposta, sem acesso ou cobrado depois de cancelar, e para quem quer tirar a vida da cabeça.

**Nome de trabalho já aplicado no app: Cabeça Leve.** Ele está em `lib/brand.ts`, `public/sw.js`, `supabase/templates/` e nos assuntos de `supabase/config.toml`. Para trocar, mude nesses lugares e rode o sweep do fim. Não registre nem pague nada pelo nome antes das checagens marcadas "a rodar", principalmente o INPI.

## 1. Nome

### Os 20 candidatos

| estilo | candidatos |
| --- | --- |
| descritivo | Anotaí, Lembra Aí, Secretária de Bolso, Agenda Viva |
| composto | **Cabeça Leve**, Dia Leve, Tudo Certo, **Cuca Fresca** |
| inventado | Lumo, Teko, Orla, Mira |
| metáfora | Prumo, Bússola, Farol, Fôlego |
| verbo ou frase | **Deixa Comigo**, **Tô Contigo**, Arrumo, **Pertinho** |

Cortados e por quê:

- **Por lembrar o original:** nada de mel, flor, abelha ou colmeia, porque o significado ficaria parecido com o do Néctar.
- **Por concorrente direto:** nomes de pessoa (Luzia, Sara, IVI) e "-ia" (Zapia), porque a categoria já está cheia deles.
- **Dia Leve:** já existe na App Store ("Dia Leve: Controle de peso").
- **Anotaí:** todos os domínios ocupados.
- **Prumo, Tino, Arrumo:** palavra curta de dicionário, com .com.br e .com ocupados.
- **Bússola e Farol:** usados por muitas marcas.
- **Lumo, Teko, Orla, Mira:** não dizem nada sobre o produto.
- **Secretária de Bolso:** longo.
- **Tudo Certo:** genérico demais para registrar.

### A lista curta

| nome | por que serve | risco |
| --- | --- | --- |
| **Cabeça Leve** (recomendado) | É o resultado que a pessoa quer, e combina com a tela inicial ("O que você quer tirar da cabeça?") e com a página de planos ("Tire a vida da cabeça"). Fácil de falar e de escrever ditado. | "Cabeça" tem cedilha: o domínio fica `cabecaleve`. |
| **Deixa Comigo** | É o posicionamento numa frase: alguém assume por você. | O .com e o .app estão ocupados. É uma expressão comum, então pode ser difícil de registrar sozinha. |
| **Tô Contigo** | Calor humano, presença. | Existem apps "Contigo" em Portugal e na Espanha. Informal demais para alguns públicos. |
| **Cuca Fresca** | Leve, brasileiro, memorável. | Já existe "Cuca Fresca: Jogos de Lógica" na App Store, em outra categoria. |
| **Pertinho** | Proximidade, carinho. | O diminutivo pode soar pequeno para um produto pago. |

### Checagens

"Livre" e "ocupado" são o resultado da consulta RDAP oficial (registro.br, Verisign, Google Registry) em 2026-10-08. "A rodar" quer dizer que a consulta não foi feita, ou foi bloqueada por limite de uso; nada aqui foi presumido.

| checagem | Cabeça Leve | Deixa Comigo | Tô Contigo | Cuca Fresca | Pertinho |
| --- | --- | --- | --- | --- | --- |
| **INPI (Brasil)**, classes 9, 42 e 35, em busca.inpi.gov.br | a rodar | a rodar | a rodar | a rodar | a rodar |
| WIPO Global Brand Database | a rodar | a rodar | a rodar | a rodar | a rodar |
| EUA (tmsearch.uspto.gov) e UE (TMview) | a rodar | a rodar | a rodar | a rodar | a rodar |
| nome.com.br | ocupado | ocupado | ocupado | a rodar | ocupado |
| nomeapp.com.br | **livre** | **livre** | a rodar | **livre** | **livre** |
| nome.com | **livre** | ocupado | **livre** | ocupado | ocupado |
| nomeapp.com | **livre** | **livre** | **livre** | **livre** | **livre** |
| nome.app | **livre** | ocupado | **livre** | ocupado | a rodar |
| App Store (Brasil), nome exato | a rodar (limite da Apple) | a rodar (limite da Apple) | nenhum app com o nome | existe "Cuca Fresca: Jogos de Lógica" | a rodar |
| Google Play | a rodar | a rodar | a rodar | a rodar | a rodar |
| busca na web (nome + app) | nenhum app ou marca com o nome | nenhum app de assistente | só apps "Contigo" (PT, ES) | (ver App Store) | a rodar |
| Instagram, TikTok, X e GitHub | a rodar | a rodar | a rodar | a rodar | a rodar |

Essas checagens são uma triagem, não uma liberação jurídica. O Brasil é onde você vende, então o INPI é a que importa. Antes de gastar com o nome (registro, domínio caro, logo), peça a um advogado de marcas uma busca de anterioridade.

## 2. Paleta

O original usa azul (#5c9ce4) e ciano sobre azul-marinho (#0a1424). A marca nova vai para o laranja quente sobre neutros quentes: longe do azul, do roxo do Nubank (que confundiria nas telas de dinheiro) e do âmbar, que lembraria mel e néctar.

| papel | escuro (padrão) | claro |
| --- | --- | --- |
| fundo | #0f0e0d | #fbfaf8 |
| superfície | #1a1816 | #ffffff |
| texto | #f5f3f0 | #1c1915 |
| texto secundário | #a8a198 | #5c564f |
| **destaque (botões, links, ícone)** | **#fb923c** | **#c2410c** |
| texto sobre o destaque | #1c1006 | #ffffff |

Entrada, saída, perigo, sucesso e aviso não mudaram: verde, rosa, vermelho e amarelo têm significado nas telas de dinheiro.

Contraste (`contrast.py`):

- tema escuro: 23 pares, nenhuma falha AA;
- tema claro: 23 pares, nenhuma falha AA.

Os valores estão em `replica/design/tokens.json`, que gera `app/tokens.css` com `npm run tokens`. As cores do original estão em `brand.json` para o sweep pegar qualquer uma que sobrar.

## 3. Briefing do logo

- **A ideia:** a cabeça fica mais leve. Algo sai de cima e sobe (um traço, uma folha, um balão), ou a tampa de um "C" se abre.
- **Tipo:** símbolo + nome escrito. O símbolo precisa funcionar sozinho no ícone do app e no favicon.
- **Tamanhos:** legível a 16 px (favicon) e no ícone de 1024 × 1024. A 16 px, no máximo 2 formas e nenhum traço fino.
- **Cores:** laranja #fb923c sobre #0f0e0d. Versão de uma cor só (preto e branco) também.
- **Entregáveis:**
  - SVG do símbolo e do nome;
  - ícone 1024 × 1024 sem transparência (iOS) e ícone adaptável do Android;
  - favicons (16, 32, 180, 192, 512);
  - imagem social 1200 × 630.
- **Não pode parecer o do original:**
  - nada de esfera, orbe ou rede de pontos;
  - nada de onda de áudio;
  - nada de gradiente azul ou ciano.
  - Ponha a marca do original ao lado dos rascunhos e confira.
- **Placeholder atual:** `public/icon.svg` é só um quadrado laranja com três linhas, até o logo chegar.

## 4. Voz

Três palavras, com o que cada uma não quer dizer:

- **Leve, não boba.** Frases curtas e calmas. Humor só quando a pessoa puxa.
- **Direta, não seca.** Diz o que fez e o que falta, sem rodeio e sem jargão. Sempre com o próximo passo.
- **Presente, não grudenta.** Responde e avisa quando importa. Não manda mensagem para "engajar".

| faça | não faça |
| --- | --- |
| "Pronto, tirei da sua cabeça: o lançamento e o lembrete." | "Sua solicitação foi processada com sucesso!" |
| "Não deu para salvar. Tente de novo." | "Ocorreu um erro inesperado (500)." |
| "Esse eu ainda não sei fazer. Tente assim: …" | "Comando inválido." |
| "Muitas mensagens em pouco tempo. Espere um minutinho e mande de novo." | "Limite de requisições excedido." |
| Falar de você para a pessoa ("seu dia", "suas contas") | "Prezado usuário", ou exclamação em toda frase |

### As 10 frases mais vistas

| onde | antes | depois |
| --- | --- | --- |
| resposta da conversa (sem a chave da IA) | "Feito: salvei o lançamento. Se algo saiu errado, é só desfazer no card." | "Pronto, tirei da sua cabeça: o lançamento. Errei algo? Toque em Desfazer no card." |
| pedido que não entende | "Ainda não consegui entender esse pedido. Por enquanto eu anoto gastos e lembretes, por exemplo: …" | "Esse eu ainda não sei fazer. Tente assim: …" |
| WhatsApp vinculado | "… Pode mandar o que precisar: …" | "… Agora é só mandar por aqui o que quiser tirar da cabeça: …" |
| WhatsApp de número desconhecido | "Este número ainda não está ligado a uma conta." | "Este número ainda não está ligado a uma conta do Cabeça Leve." |
| teste grátis acabou | "… Seus dados continuam guardados." | "… Tudo o que você anotou continua guardado." |
| conversa vazia | "O que você quer tirar da cabeça?" | mantida (já é a voz) |
| planos | "Tire a vida da cabeça" | mantida |
| erro ao salvar | "Não deu para salvar. Tente de novo." | mantida |
| cadastro | "Quase lá: mandamos um link de confirmação para …" | mantida |
| e-mails | "… sua conta no Assistente." | "… sua conta no Cabeça Leve.", com o nome também no assunto |

Também saiu da frente da pessoa o código interno das telas ("S11", "S29"…), que aparecia em cima de cada título. Agora fica só no HTML (`data-screen`).

## 5. Sweep

```bash
python3 ~/.claude/skills/replica-brand/sweep.py . --config replica/brand.json   # Clean
grep -rniw "nectar\|néctar" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=replica .   # 0
```

"Nectar" sem acento ficou fora da lista do sweep, porque ele procura dentro das palavras e "conectar" e "desconectar" contêm "nectar". Essa grafia é conferida pelo grep acima, por palavra inteira.

Conferido a olho:

- título da aba e nome do app (`metadata`);
- cor do navegador (`themeColor`);
- favicon e ícone (placeholder laranja);
- título das notificações push;
- três e-mails e seus assuntos;
- descrição da cobrança na Asaas;
- nome que o agente usa para se apresentar.

Falta, porque depende do logo: a imagem social 1200 × 630 e o ícone definitivo.
