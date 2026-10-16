import {
  BellRing, Check, CircleSlash, Dumbbell, FileText, Globe, KeyRound, LifeBuoy, ListChecks, MessageCircle, NotebookPen, ReceiptText, ShieldCheck, Sparkles, Sun, Target, Timer, Users, WalletCards, type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import conversa from "@/public/landing/conversa.png";
import { cn } from "@/components/ui/cn";
import { BRAND } from "@/lib/brand";
import { forSale, perMonthCents, planPeriod, planSaving, TRIAL_DAYS, waText } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/time";
import { WHATSAPP_PROMISE } from "@/lib/whatsapp/promise";

// Sempre no pedido: no build não há banco nem sessão, e a página estática ficava presa no
// redirecionamento para /conversa (com cache de 1 ano), sem nunca mostrar o início a quem não entrou
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `${BRAND.name} · o assistente no WhatsApp para a cabeça que não para`, description: BRAND.description };

// Landing (replica/launch/landing.md): ângulo "o assistente que responde quando você precisa".
// Sem depoimento, número de usuários ou nota inventada; a captura é do app de verdade.
const cta = "inline-flex h-12 items-center justify-center rounded-md px-6 text-base font-semibold";
const primary = "bg-accent text-on-accent hover:opacity-90";
const secondary = "border border-border text-text hover:bg-surface-2";

const PROBLEMS: { title: string; text: string }[] = [
  { title: "Você pagou e ficou sem resposta", text: "Acesso que não libera, suporte que é só robô e cobrança que continua depois de cancelar." },
  { title: "Você anota e ele não acha", text: "Lembrete que não chega e relatório que não bate com o que você lançou." },
];

// Para quem se perde no meio do dia, com ou sem TDAH. Só o que o app faz hoje; nada de promessa de tratamento.
const MINDS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MessageCircle, title: "Mande do jeito que vier", text: "Um áudio no meio da rua, uma frase solta, a foto da nota. Sem formulário, sem escolher categoria: o assistente organiza e confirma com um card que dá para desfazer." },
  { icon: BellRing, title: "Lembrete que volta", text: "O aviso chega no celular e no WhatsApp com Feito e Adiar. Não deu agora? Toque em Adiar e ele volta daqui a pouco, sem bronca." },
  { icon: Timer, title: "Um passo de cada vez", text: "Respostas curtas e uma pergunta por vez. Dá para pedir para quebrar uma tarefa grande em passos pequenos." },
  { icon: Sparkles, title: "Do seu jeito, sem julgamento", text: "Escolha o tom: acolhedor, direto, divertido ou sem filtro. Ele nunca humilha: no máximo cobra com bom humor, e só se você pedir." },
];

const STEPS = [
  ["Crie a conta", `${TRIAL_DAYS} dias grátis, sem cartão.`],
  ["Vincule o WhatsApp", "Você conversa com o número do assistente."],
  ["Fale do seu jeito", "Texto, áudio ou foto. Ele organiza e confirma com um card que dá para desfazer."],
];

// Cada item é uma correção do fixes.md (F1 a F7); o que é preço de entrada fica na linha de baixo
const FIXES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LifeBuoy, title: "Uma pessoa de verdade", text: "Peça na conversa ou em Configurações: o chamado tem protocolo e alguém do time responde em até 1 dia útil. O assistente nunca finge ser o suporte." },
  { icon: CircleSlash, title: "Cancelou, parou", text: "Um toque em Configurações e o comprovante com protocolo sai na hora. Se uma cobrança chegar depois, ela é estornada sozinha." },
  { icon: Check, title: "Pagou, entrou", text: "Enquanto o pagamento confirma, o acesso continua. Nada de “assinatura inválida”." },
  { icon: BellRing, title: "Lembrete que chega", text: "No celular e no WhatsApp, com Feito e Adiar. Dá para testar o aviso na hora, em Configurações." },
  { icon: ReceiptText, title: "Conta que bate", text: "Os totais vêm do que você lançou, não de um palpite da IA. O teto por categoria avisa em 80% e em 100%." },
  { icon: ShieldCheck, title: "Seu WhatsApp fica intacto", text: "Você manda mensagem para o assistente. Ele não entra na sua conta nem escreve para os seus contatos." },
];

// Tudo o que o app faz hoje, com a frase que a pessoa de fato manda. Só recurso que existe: nada de sincronizar
// com Google/Outlook, nada de diagnóstico ou tratamento.
const FEATURES: { icon: LucideIcon; title: string; text: string; example?: string }[] = [
  { icon: ListChecks, title: "Tarefas e lembretes", text: "Prazo, prioridade e repetição. O aviso chega no celular e no WhatsApp com Feito e Adiar.", example: "Me lembra de pagar a luz amanhã às 9h" },
  { icon: WalletCards, title: "Dinheiro", text: "Gastos por texto, áudio ou foto da nota. Contas fixas, parcelas, cartões e teto por categoria com aviso em 80% e 100%.", example: "Gastei 48 no mercado" },
  { icon: Dumbbell, title: "Treino e alimentação", text: "Fichas de treino, plano alimentar, peso e medidas. Crie pelo chat ou mande a foto da ficha.", example: "Monta meu treino A e B de segunda a sexta" },
  { icon: Target, title: "Hábitos e metas", text: "Hábitos com sequência de dias e lembrete no horário. Metas com progresso que você acompanha.", example: "Quero ler 20 minutos todo dia às 21h" },
  { icon: FileText, title: "Documentos e reembolso", text: "Notas, recibos e pedidos médicos em pastas, marcados como pendente, enviado ou reembolsado. Avisa o prazo e devolve o arquivo no WhatsApp, ou um PDF único para anexar.", example: "Guarda essa nota na pasta Viagem SP" },
  { icon: Globe, title: "Pesquisa diária", text: "Todo dia, o assistente pesquisa na internet o que você pediu e manda o resumo com as fontes.", example: "Me traz todo dia os projetos mais populares do GitHub" },
  { icon: NotebookPen, title: "Projetos, notas e foco", text: "Projetos com etapas, notas, diário e modo foco para fazer uma coisa de cada vez.", example: "Anota que o prazo do projeto é dia 30" },
  { icon: Sun, title: "Seu dia num lugar", text: "Agenda, tarefas, hábitos e contas de hoje juntos, e um resumo que chega de manhã.", example: "O que eu tenho hoje?" },
  { icon: KeyRound, title: "Cofre de senhas", text: "Senhas e códigos cifrados no aparelho, só no app: nem o time nem o assistente conseguem ler o que está lá." },
  { icon: Users, title: "Casal e família", text: "Vários WhatsApps na mesma conta. Cada gasto mostra quem lançou.", example: "Gastei 120 na farmácia" },
];

const TOPICS = ["Tarefas", "Lembretes", "Dinheiro", "Treino e dieta", "Hábitos e metas", "Documentos e reembolso", "Pesquisa diária", "Cofre de senhas"];

const FAQ: [string, string][] = [
  ["É um app para TDAH?", `Foi pensado para quem se perde no meio do dia, tenha ou não TDAH: manda do jeito que vier, recebe lembrete com Feito e Adiar e respostas curtas. Não é tratamento, não faz diagnóstico e não substitui o acompanhamento de um profissional. Quem tem TDAH não precisa dizer isso a ninguém para usar.`],
  ["Posso testar antes de pagar?", `Sim, ${TRIAL_DAYS} dias, sem cartão. No fim, você escolhe se assina. Tudo o que anotou continua guardado.`],
  ["E se eu quiser cancelar?", "Um toque em Configurações. Comprovante na hora, nenhuma cobrança nova e acesso até o fim do período pago. Cobrança que chegar depois é estornada sozinha."],
  ["Vocês acessam o meu WhatsApp?", WHATSAPP_PROMISE],
  ["Paguei e não liberou. E agora?", "O acesso continua enquanto o pagamento confirma. Se algo travar, peça uma pessoa: o chamado tem protocolo e prazo."],
  ["Consigo trazer o que eu já tenho em outro app?", "Ainda não há importação automática. Mande a lista de contas fixas e lembretes pela conversa, que ele cadastra."],
  ["A IA pode errar?", "Pode. Cada coisa que ela registra vem num card com Desfazer, e os totais vêm do que foi lançado."],
];

export default async function Page() {
  // quem já entrou segue direto para a conversa; sem o banco ligado (demonstração) também
  if (!isSupabaseConfigured() || (await currentUser())) redirect("/conversa");
  const plans = await loadPlans();
  const selling = forSale(plans);
  return (
    <div className="flex flex-col gap-20">
      <section aria-labelledby="titulo" className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col items-start gap-5">
          <h1 id="titulo" className="text-4xl font-bold leading-tight text-text sm:text-5xl">
            Peraí, o que eu ia fazer mesmo?
          </h1>
          <p className="max-w-xl text-lg text-body">
            O assistente no WhatsApp que cuida da sua vida inteira numa conversa: tarefas, lembretes, dinheiro, treino, saúde, hábitos, documentos e pesquisas. Para organizar a cabeça, com ou sem TDAH. E uma pessoa de verdade quando você precisar.
          </p>
          <ul aria-label="O que o assistente cuida" className="flex max-w-xl flex-wrap gap-2">
            {TOPICS.map((t) => (
              <li key={t} className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-body">{t}</li>
            ))}
          </ul>
          <p className="max-w-xl text-sm text-muted">{TRIAL_DAYS} dias grátis sem cartão, cancelamento em um toque com comprovante.</p>
          <Link href="/entrar?modo=criar" className={cn(cta, primary)}>Começar {TRIAL_DAYS} dias grátis</Link>
          <p className="text-sm text-muted">{WHATSAPP_PROMISE}</p>
        </div>
        <Image src={conversa} alt="O app de verdade: na conversa, um lembrete e uma tarefa criados a partir de frases comuns, cada um com o botão Desfazer"
          priority sizes="(min-width: 1024px) 380px, 90vw" className="mx-auto w-full max-w-[380px] rounded-2xl border border-border shadow-pop" />
      </section>

      <section aria-labelledby="tudo" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="tudo" className="text-2xl font-bold text-text sm:text-3xl">Tudo o que cabe na sua cabeça, num lugar só</h2>
          <p className="max-w-2xl text-body">É só falar no WhatsApp, por texto, áudio ou foto. O {BRAND.name} organiza e mostra tudo também no app.</p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, example }) => (
            <li key={title} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
              {example && <p className="mt-auto rounded-md rounded-bl-none bg-surface-2 px-3 py-2 text-sm text-text">“{example}”</p>}
            </li>
          ))}
        </ul>
        <div><Link href="/entrar?modo=criar" className={cn(cta, primary)}>Começar {TRIAL_DAYS} dias grátis</Link></div>
      </section>

      <section aria-labelledby="cabecas" className="flex flex-col gap-6">
        <h2 id="cabecas" className="text-2xl font-bold text-text">Feito para cabeças que não param</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MINDS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">O {BRAND.name} é uma ferramenta de organização. Não faz diagnóstico, não trata TDAH e não substitui o acompanhamento de um profissional de saúde.</p>
      </section>

      <section aria-labelledby="problema" className="flex flex-col gap-6">
        <h2 id="problema" className="text-2xl font-bold text-text">Assistente que some na hora que você mais precisa</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROBLEMS.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <h3 className="font-semibold text-text">{p.title}</h3>
              <p className="text-sm text-body">{p.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-body">Aqui é diferente desde o primeiro dia.</p>
      </section>

      <section aria-labelledby="como" className="flex flex-col gap-6">
        <h2 id="como" className="text-2xl font-bold text-text">Como começa</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-on-accent">{i + 1}</span>
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="diferente" className="flex flex-col gap-6">
        <h2 id="diferente" className="text-2xl font-bold text-text">O que você pode cobrar da gente</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIXES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="preco" className="flex flex-col gap-6">
        <h2 id="preco" className="text-2xl font-bold text-text">Um preço simples</h2>
        <ul className={cn("grid grid-cols-1 gap-4", selling.length > 1 && "sm:grid-cols-2", selling.length > 2 && "lg:grid-cols-3")}>
          {selling.map((p) => {
            const saving = planSaving(p, plans);
            return (
              <li key={p.id} className={cn("flex flex-col gap-3 rounded-lg border bg-surface p-6", p.featured ? "border-accent" : "border-border")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text">{p.name}</h3>
                  {saving !== null && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">economize {Math.round(saving * 100)}%</span>}
                </div>
                <p><span className="font-mono text-3xl font-semibold text-text">{formatMoney(p.priceCents)}</span> <span className="text-sm text-muted">{planPeriod(p)}</span></p>
                <p className="text-sm text-body">{p.tagline ?? (p.months > 1 ? `equivale a ${formatMoney(perMonthCents(p))} por mês` : p.recurring ? "no cartão, cancele quando quiser" : "pagamento único, sem renovação automática")}</p>
                <p className="flex items-center gap-2 text-sm text-body"><Check aria-hidden className="size-4 text-success" />{waText(p.whatsappLimit)} e tudo do app</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">{TRIAL_DAYS} dias grátis antes de qualquer cobrança. <Link href="/planos" className="font-medium text-text underline">Ver os planos</Link></p>
      </section>

      <section aria-labelledby="duvidas" className="flex flex-col gap-4">
        <h2 id="duvidas" className="text-2xl font-bold text-text">Dúvidas</h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-text">{q}</summary>
              <p className="mt-2 text-sm text-body">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="final" className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center">
        <h2 id="final" className="text-2xl font-bold text-text">Anote antes que escape</h2>
        <p className="text-body">Comece pelo que está pesando agora: uma conta, um lembrete, um treino, uma nota para guardar.</p>
        <Link href="/entrar?modo=criar" className={cn(cta, primary)}>Começar {TRIAL_DAYS} dias grátis</Link>
        <Link href="/entrar" className={cn(cta, secondary, "h-10 text-sm")}>Já tenho conta</Link>
      </section>
    </div>
  );
}
