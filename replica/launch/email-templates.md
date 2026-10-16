# E-mails do Supabase (confirmação, nova senha, troca de e-mail)

Os três modelos moram em `supabase/templates/` e valem para o Supabase local (`supabase/config.toml`). Em produção, o Supabase não lê esses arquivos: é preciso **colar o conteúdo no painel**.

| Modelo | Arquivo | Onde colar (Supabase > Authentication > Emails > Templates) | Assunto sugerido |
| --- | --- | --- | --- |
| Confirmar cadastro | `confirmacao.html` | **Confirm sign up** | `Peraí: confirme seu e-mail` |
| Nova senha | `nova-senha.html` | **Reset password** | `Peraí: crie uma senha nova` |
| Trocar e-mail | `troca-email.html` | **Change email address** | `Peraí: confirme o e-mail novo` |

Passo a passo: abra o modelo, troque a aba para **Source**, apague o conteúdo, cole o arquivo inteiro, preencha o assunto e salve.

## O que cada modelo usa

- `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=...`: o link do botão (e o endereço de reserva embaixo). Não mude esse trecho. Ele leva a uma página do app com um botão; só o toque nesse botão gasta o link. Por isso o link funciona abrindo o e-mail em outro aparelho ou navegador, e o leitor de links do provedor de e-mail não o "queima". (O `{{ .ConfirmationURL }}` padrão usa o fluxo PKCE, que só funciona no mesmo navegador do cadastro, e deu "link inválido".)
- `{{ .SiteURL }}`: o **Site URL** de Authentication > URL Configuration. O ícone do cabeçalho vem de `{{ .SiteURL }}/icons/icon-192.png`, então o Site URL precisa ser `https://perai.vozzyup.com.br`.
- `{{ .Email }}` (confirmação) e `{{ .NewEmail }}` (troca de e-mail).

## Como foi feito

- Tabelas e estilos na própria tag, porque a maioria dos programas de e-mail ignora CSS externo. Largura de 560 px, que encolhe no celular.
- O botão é laranja `#fb923c` com texto escuro `#1a1816` (contraste acima de 8:1). Link de texto em `#b45309` no claro e `#fb923c` no escuro.
- Modo escuro: segue o aparelho onde o programa de e-mail aceita (Apple Mail, iOS, Gmail no app). Onde não aceita, aparece o claro.
- Funciona sem imagem: quem bloqueia imagens vê só a palavra "Peraí" no topo.
- Texto de prévia escondido (aparece ao lado do assunto na caixa de entrada).
- A promessa do e-mail de cadastro ("7 dias grátis, sem cartão") é a mesma da landing e vem de `TRIAL_DAYS`; se mudar o teste, mude aqui também.

## Para o e-mail chegar de verdade

- O envio padrão do Supabase tem limite baixo por hora e sai de um remetente genérico. Em Authentication > Emails > SMTP Settings, ligue o SMTP próprio (a conta do Resend que o app já usa serve: host `smtp.resend.com`, porta 465, usuário `resend`, senha = a chave da API) e use o remetente `Peraí <ola@seudominio.com.br>`.
- Authentication > URL Configuration: Site URL `https://perai.vozzyup.com.br` e, em Redirect URLs, `https://perai.vozzyup.com.br/**`.
