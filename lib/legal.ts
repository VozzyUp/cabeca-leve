import { BRAND } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/plans";

// Textos das páginas legais (/privacidade e /termos). Quem opera o app preenche os dados da
// empresa em Admin > Configurações. Estes textos são uma base: peça a revisão de um advogado
// antes de cobrar de clientes.
export const LEGAL_UPDATED = "9 de outubro de 2026";

export type Block = string | { list: string[] };
export type Section = { title: string; body: Block[] };

export function operator(env: Record<string, string | undefined> = process.env) {
  const name = env.LEGAL_COMPANY_NAME?.trim() || BRAND.name;
  const document = env.LEGAL_COMPANY_DOCUMENT?.trim() || null;
  const email = env.LEGAL_CONTACT_EMAIL?.trim() || env.SUPPORT_EMAIL?.trim() || null;
  return { name, document, email };
}

const who = (o: ReturnType<typeof operator>) => `${o.name}${o.document ? ` (CNPJ/CPF ${o.document})` : ""}`;
const contact = (o: ReturnType<typeof operator>) => (o.email ? `pelo e-mail ${o.email}` : "pelo chamado dentro do app (Ajustes > Falar com uma pessoa)");

export function privacySections(o = operator()): Section[] {
  return [
    { title: "Quem somos", body: [
      `O ${BRAND.name} é operado por ${who(o)}, que é o controlador dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).`,
      `Para falar sobre dados pessoais, escreva ${contact(o)}.`,
    ] },
    { title: "Quais dados tratamos", body: [
      "Só tratamos o que o assistente precisa para funcionar:",
      { list: [
        "Cadastro: nome, e-mail e senha (guardada de forma protegida, nunca em texto puro).",
        "Número de WhatsApp que você vincula, para o assistente reconhecer você e responder.",
        "O que você pede ao assistente: mensagens, tarefas, lembretes, gastos, contas, hábitos, metas, notas, treino, alimentação e medidas que você registra.",
        "Fotos que você envia na conversa e a transcrição de áudios que você manda (o áudio em si não fica guardado).",
        "Fatos que você pede para o assistente lembrar (a “memória”), que você vê e apaga em Ajustes.",
        "Pagamento: a Asaas processa o cartão ou o Pix. Nós guardamos só o plano, o status e as datas, nunca o número do cartão.",
        "Dados técnicos de uso: horário das mensagens, volume de uso da IA (para limite e custo) e o registro do aparelho que recebe notificações.",
      ] },
      "Você pode registrar dados sensíveis (por exemplo, medidas, treino e alimentação) por vontade própria. Eles são tratados só para o serviço funcionar para você.",
    ] },
    { title: "Para que usamos e em que base legal", body: [
      { list: [
        "Prestar o serviço que você contratou: responder, lembrar, organizar e enviar avisos (execução de contrato).",
        "Cobrar a assinatura e emitir comprovantes (execução de contrato e obrigação legal).",
        "Proteger o serviço contra abuso e controlar o custo, com limites de uso por dia (legítimo interesse).",
        "Atender seus pedidos de suporte (execução de contrato).",
        "Mandar avisos do serviço por e-mail, notificação e WhatsApp, que você liga e desliga em Ajustes (consentimento).",
      ] },
      "Não vendemos seus dados, não usamos o que você escreve para fazer propaganda e não treinamos modelos de IA com a sua conversa.",
    ] },
    { title: "Com quem compartilhamos", body: [
      "Usamos fornecedores (operadores) que tratam os dados só para nos prestar o serviço:",
      { list: [
        "Supabase: banco de dados e login.",
        "Anthropic: a inteligência artificial que lê sua mensagem (e foto) e escreve a resposta.",
        "Groq: transcrição dos áudios em texto.",
        "WhatsApp: a mensagem passa pelo provedor de conexão do WhatsApp que usamos (UAZAPI ou a API oficial da Meta).",
        "Asaas: cobrança e pagamento.",
        "Resend: e-mails de recibo, resumo e avisos.",
        "O serviço de notificação do seu navegador ou celular, para o aviso chegar com o app fechado.",
        "A hospedagem do servidor onde o app roda.",
      ] },
      "Alguns desses fornecedores ficam fora do Brasil (por exemplo, nos Estados Unidos). Nesses casos, a transferência acontece para a execução do contrato e com fornecedores que adotam medidas de segurança adequadas.",
      "Também podemos compartilhar dados quando uma lei ou uma ordem judicial exigir.",
    ] },
    { title: "O que o assistente não faz", body: [
      "Nós nunca pedimos acesso ao seu WhatsApp pessoal. Você conversa com o número do assistente, e ele nunca escreve para os seus contatos.",
      "A IA pode errar. Confira o que ela registrar, principalmente valores e horários. Dá para desfazer pelo card de cada ação.",
    ] },
    { title: "Por quanto tempo guardamos", body: [
      { list: [
        "Seus registros ficam enquanto a conta existir.",
        "Fotos enviadas na conversa são apagadas automaticamente depois de 2 dias. O texto da conversa permanece.",
        "Ao excluir a conta em Ajustes, apagamos seus dados. Alguns registros de cobrança podem ser mantidos pelo prazo que a lei exigir.",
      ] },
    ] },
    { title: "Seus direitos", body: [
      "Pela LGPD, você pode pedir confirmação de que tratamos seus dados, acesso, correção, portabilidade, informação sobre com quem compartilhamos, revogação de consentimento e exclusão.",
      "Em Ajustes você mesmo pode baixar todos os seus dados, editar ou apagar a memória do assistente e excluir a conta. Para qualquer outro pedido, escreva " + contact(o) + ". Respondemos em até 15 dias.",
      "Se achar que seus dados foram tratados de forma indevida, você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
    ] },
    { title: "Segurança", body: [
      "Usamos conexão criptografada, senhas protegidas, acesso restrito ao banco e chaves de integração guardadas criptografadas. Nenhum sistema é totalmente imune, e avisaremos você e a ANPD se houver um incidente que traga risco relevante.",
    ] },
    { title: "Menores de idade", body: ["O serviço é para maiores de 18 anos."] },
    { title: "Cookies e armazenamento", body: [
      "Usamos apenas o necessário: um cookie de sessão para manter você conectado e o armazenamento do navegador para preferências e para o app funcionar sem conexão. Não usamos cookies de propaganda.",
    ] },
    { title: "Mudanças nesta política", body: [`Se mudarmos algo importante, avisamos pelo app ou por e-mail. A data da última atualização está no topo desta página (${LEGAL_UPDATED}).`] },
  ];
}

export function termsSections(o = operator()): Section[] {
  return [
    { title: "O serviço", body: [
      `O ${BRAND.name} é um assistente pessoal com inteligência artificial que organiza tarefas, lembretes, finanças, hábitos e rotina por conversa, no app e no WhatsApp. Ele é operado por ${who(o)}.`,
      "Ao criar uma conta você declara que tem 18 anos ou mais e concorda com estes termos e com a Política de Privacidade.",
    ] },
    { title: "Sua conta", body: [
      "Você é responsável por manter sua senha em segurança e pelo que acontece na sua conta. Cada conta é de uma pessoa. Se achar que alguém acessou sua conta, avise e troque a senha.",
    ] },
    { title: "Teste grátis, assinatura e cobrança", body: [
      `Novos usuários têm ${TRIAL_DAYS} dias grátis. Depois, é preciso assinar um plano (mensal ou anual) para continuar a usar o assistente. Tudo o que você anotou continua guardado.`,
      "Os valores e as formas de pagamento estão em Planos. A cobrança é feita pela Asaas, e a assinatura se renova no fim de cada período até ser cancelada.",
      "Você pode cancelar quando quiser, em Ajustes. Você recebe um comprovante com protocolo, nenhuma cobrança nova é feita e o acesso continua até o fim do período já pago.",
      "Direito de arrependimento: em compras feitas pela internet, você pode desistir em até 7 dias corridos da contratação e receber o valor pago de volta, conforme o Código de Defesa do Consumidor. Peça por " + (o.email ? `e-mail (${o.email})` : "chamado dentro do app") + ".",
    ] },
    { title: "Uso do assistente", body: [
      "Use o serviço de forma lícita. Não é permitido:",
      { list: [
        "usar o assistente para enviar spam, golpes, ameaças ou conteúdo ilegal;",
        "tentar burlar os limites de uso, invadir ou sobrecarregar o serviço;",
        "usar o serviço para revender acesso ou automatizar o uso em escala sem combinar antes.",
      ] },
      "Para proteger o serviço, existem limites diários de uso, que podem ser diferentes no período de teste e nos planos pagos. Se você atingir o limite, o assistente avisa e volta no dia seguinte.",
    ] },
    { title: "A IA pode errar", body: [
      "As respostas e os registros são gerados por inteligência artificial e podem ter erros. Confira o que importa, principalmente valores, datas e horários de lembretes.",
      "O assistente não é médico, nutricionista, educador físico, contador nem advogado. Treinos, planos alimentares, números de gastos e outras sugestões são apoio para a sua organização, não orientação profissional. Em caso de dúvida de saúde ou de dinheiro, procure um profissional.",
    ] },
    { title: "WhatsApp", body: [
      "Você conversa com o número do assistente. Nós nunca pedimos acesso ao seu WhatsApp pessoal, e o assistente nunca escreve para os seus contatos. O WhatsApp é um serviço de terceiros e pode ter instabilidades ou mudar suas regras, o que pode afetar o envio e o recebimento de mensagens.",
    ] },
    { title: "Seus conteúdos", body: [
      "O que você registra continua sendo seu. Você nos autoriza a tratar esses conteúdos apenas para prestar o serviço, como descrito na Política de Privacidade. Você pode baixar tudo ou excluir a conta a qualquer momento, em Ajustes.",
    ] },
    { title: "Disponibilidade e suporte", body: [
      "Trabalhamos para o serviço ficar no ar sempre, mas não garantimos funcionamento sem interrupção, porque ele depende de fornecedores como a IA, o WhatsApp e a hospedagem. Se precisar de ajuda, peça para falar com uma pessoa em Ajustes ou na conversa. O chamado tem protocolo, e respondemos em até 1 dia útil.",
    ] },
    { title: "Responsabilidade", body: [
      "Respondemos pelos danos que a lei determina. Na medida permitida em lei, não nos responsabilizamos por decisões tomadas apenas com base em respostas da IA, nem por falhas causadas por fornecedores ou por fatos fora do nosso controle. Nada aqui retira direitos que o Código de Defesa do Consumidor garante a você.",
    ] },
    { title: "Encerramento", body: [
      "Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar uma conta que descumpra estes termos, avisando o motivo sempre que possível.",
    ] },
    { title: "Mudanças e lei aplicável", body: [
      `Podemos atualizar estes termos e avisaremos pelo app ou por e-mail quando a mudança for relevante. A data da última atualização está no topo (${LEGAL_UPDATED}). Estes termos seguem as leis do Brasil, e você pode escolher o foro do seu domicílio para resolver qualquer disputa.`,
    ] },
    { title: "Contato", body: [`Dúvidas sobre estes termos: ${contact(o)}.`] },
  ];
}
